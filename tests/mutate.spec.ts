/**
 * Mutation orchestration tests: policy gates, ordering, rollback.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runToggle, type EntryHandle, type MutateDeps } from '../src/mutate.ts'
import { ConcurrentEditError } from '../src/profile-patch.ts'
import { REVIEWED_DSH_WEB_BASELINE } from '../src/evidence.ts'
import type { MutationAction } from '../src/policy.ts'

function entry(overrides: Partial<EntryHandle> = {}): EntryHandle {
  return {
    facts: { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active' },
    ownDisabled: undefined,
    declaredInject: null,
    declaredInjectKnown: true,
    update: async () => {},
    ...overrides,
  }
}

interface Trace {
  updates: (boolean | null)[]
  persists: { id: string; action: MutationAction }[]
  persistError?: unknown
}

function deps(handle: EntryHandle | undefined, trace: Trace): MutateDeps {
  return {
    patchFile: '/tmp/fake/cordis.patch.yml',
    listEntries: () => handle === undefined ? [] : [handle],
    eligibilityBaseline: [REVIEWED_DSH_WEB_BASELINE.find((candidate) => candidate.id === 'ui-goal')!],
    profilePreflight: () => ({ status: 'writable' }),
    persist: async (_file, id, action) => {
      trace.persists.push({ id, action })
      if (trace.persistError !== undefined) throw trace.persistError
      return { changed: true }
    },
  }
}

function trackingEntry(trace: Trace): EntryHandle {
  const handle = entry()
  handle.update = async (options) => {
    trace.updates.push(options.disabled ?? null)
    handle.facts = { ...handle.facts, disabled: options.disabled === true }
    handle.ownDisabled = options.disabled ?? undefined
  }
  return handle
}

describe('runToggle', () => {
  it('forbidden id → 403, nothing touched', async () => {
    const trace: Trace = { updates: [], persists: [] }
    const result = await runToggle(deps(entry(), trace), 'ui-cordis', { disabled: true })
    assert.equal(result.status, 403)
    assert.deepEqual(trace.updates, [])
    assert.deepEqual(trace.persists, [])
  })

  it('missing entry → 404, nothing touched', async () => {
    const trace: Trace = { updates: [], persists: [] }
    const result = await runToggle(deps(undefined, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 404)
    assert.deepEqual(trace.updates, [])
    assert.deepEqual(trace.persists, [])
  })

  it('invalid body → 400, nothing touched', async () => {
    const trace: Trace = { updates: [], persists: [] }
    for (const body of [undefined, null, '{}', { disabled: 'no' }]) {
      const result = await runToggle(deps(entry(), trace), 'ui-goal', body)
      assert.equal(result.status, 400, JSON.stringify(body))
    }
    assert.deepEqual(trace.updates, [])
    assert.deepEqual(trace.persists, [])
  })

  it('official entry + valid body → 200, runtime then persist', async () => {
    const trace: Trace = { updates: [], persists: [] }
    const handle = trackingEntry(trace)
    const result = await runToggle(deps(handle, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 200)
    if (result.status === 200) {
      assert.deepEqual(result.body, { ok: true, id: 'ui-goal', action: 'force-disable', disabled: true, runtime: true, persisted: true })
    }
    assert.deepEqual(trace.updates, [true])
    assert.deepEqual(trace.persists, [{ id: 'ui-goal', action: 'force-disable' }])
  })

  it('supports explicit force enable and restores inheritance through persisted profile recomposition', async () => {
    const enableTrace: Trace = { updates: [], persists: [] }
    const enable = await runToggle(deps(trackingEntry(enableTrace), enableTrace), 'ui-goal', { action: 'force-enable' })
    assert.equal(enable.status, 200)
    assert.deepEqual(enableTrace.updates, [false])
    assert.deepEqual(enableTrace.persists, [{ id: 'ui-goal', action: 'force-enable' }])

    const restoreTrace: Trace = { updates: [], persists: [] }
    const restore = await runToggle(deps(trackingEntry(restoreTrace), restoreTrace), 'ui-goal', { action: 'restore-inheritance' })
    assert.equal(restore.status, 200)
    if (restore.body.ok) assert.equal(restore.body.disabled, null)
    // `Entry.update({ disabled: null })` cannot recompose lower profile layers.
    assert.deepEqual(restoreTrace.updates, [])
    assert.deepEqual(restoreTrace.persists, [{ id: 'ui-goal', action: 'restore-inheritance' }])
  })

  for (const reason of [
    'profile_patch_missing',
    'profile_patch_unreadable',
    'duplicate_top_level_row',
    'duplicate_disabled_field',
    'non_literal_disabled',
  ] as const) {
    it(`profile preflight ${reason} → 409 before runtime update or persistence`, async () => {
      const trace: Trace = { updates: [], persists: [] }
      const testDeps = deps(trackingEntry(trace), trace)
      testDeps.profilePreflight = () => ({ status: 'unwritable', reason })
      const result = await runToggle(testDeps, 'ui-goal', { action: 'force-disable' })
      assert.equal(result.status, 409)
      assert.equal(result.body.error, 'mutation_ineligible')
      assert.deepEqual(trace.updates, [])
      assert.deepEqual(trace.persists, [])
    })
  }

  it('refuses package mismatch and duplicate target before runtime or persistence', async () => {
    const mismatchTrace: Trace = { updates: [], persists: [] }
    const badDeps = deps(trackingEntry(mismatchTrace), mismatchTrace)
    const bad = badDeps.listEntries()[0]!
    bad.facts = { ...bad.facts, name: '@deepseek-ai/dsh-client-ui-goal-v2' }
    const mismatchResult = await runToggle(badDeps, 'ui-goal', { disabled: true })
    assert.equal(mismatchResult.status, 409)
    assert.deepEqual(mismatchTrace.updates, [])
    assert.deepEqual(mismatchTrace.persists, [])

    const duplicateTrace: Trace = { updates: [], persists: [] }
    const duplicateDeps = deps(trackingEntry(duplicateTrace), duplicateTrace)
    // A direct list is clearer than relying on a loader's normal uniqueness guarantee.
    const target = trackingEntry(duplicateTrace)
    duplicateDeps.listEntries = () => [target, { ...target }]
    const duplicateResult = await runToggle(duplicateDeps, 'ui-goal', { disabled: true })
    assert.equal(duplicateResult.status, 409)
    assert.deepEqual(duplicateTrace.updates, [])
    assert.deepEqual(duplicateTrace.persists, [])
  })

  it('persistence failure → runtime rolled back to previous own value, error surfaced', async () => {
    const trace: Trace = { updates: [], persists: [], persistError: new Error('disk full') }
    const handle = trackingEntry(trace)
    handle.ownDisabled = false // previously persisted as disabled:false
    const result = await runToggle(deps(handle, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 500)
    assert.equal(result.body.error, 'persist_failed')
    // update(true) then rollback update(false)
    assert.deepEqual(trace.updates, [true, false])
    assert.deepEqual(trace.persists, [{ id: 'ui-goal', action: 'force-disable' }])
  })

  it('persistence failure with no previous own value → rollback removes the field (null)', async () => {
    const trace: Trace = { updates: [], persists: [], persistError: new Error('nope') }
    const handle = trackingEntry(trace)
    const result = await runToggle(deps(handle, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 500)
    assert.deepEqual(trace.updates, [true, null])
  })

  it('concurrent edit during persist → 409 and runtime rolled back', async () => {
    const trace: Trace = { updates: [], persists: [], persistError: new ConcurrentEditError('/tmp/fake') }
    const handle = trackingEntry(trace)
    const result = await runToggle(deps(handle, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 409)
    assert.equal(result.body.error, 'concurrent_edit')
    assert.deepEqual(trace.updates, [true, null])
  })

  it('runtime update failure → 500, persist never attempted', async () => {
    const trace: Trace = { updates: [], persists: [] }
    const handle = entry()
    handle.update = async () => { throw new Error('loader exploded') }
    const result = await runToggle(deps(handle, trace), 'ui-goal', { disabled: true })
    assert.equal(result.status, 500)
    assert.equal(result.body.error, 'runtime_update_failed')
    assert.deepEqual(trace.persists, [])
  })

  it('successful disable + persist where file already matches → persisted:false, still 200', async () => {
    const trace: Trace = { updates: [], persists: [] }
    const depsObj = deps(trackingEntry(trace), trace)
    depsObj.persist = async () => ({ changed: false })
    const result = await runToggle(depsObj, 'ui-goal', { disabled: true })
    assert.equal(result.status, 200)
    if (result.body.ok) assert.equal(result.body.persisted, false)
  })
})
