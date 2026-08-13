/**
 * Mutation orchestration tests: policy gates, ordering, rollback.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { runToggle, type EntryHandle, type MutateDeps } from '../src/mutate.ts'
import { ConcurrentEditError } from '../src/profile-patch.ts'

function entry(overrides: Partial<EntryHandle> = {}): EntryHandle {
  return {
    facts: { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active' },
    ownDisabled: undefined,
    update: async () => {},
    ...overrides,
  }
}

interface Trace {
  updates: (boolean | null)[]
  persists: { id: string; disabled: boolean }[]
  persistError?: unknown
}

function deps(handle: EntryHandle | undefined, trace: Trace): MutateDeps {
  return {
    patchFile: '/tmp/fake/cordis.patch.yml',
    findEntry: () => handle,
    persist: async (_file, id, disabled) => {
      trace.persists.push({ id, disabled })
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
      assert.deepEqual(result.body, { ok: true, id: 'ui-goal', disabled: true, runtime: true, persisted: true })
    }
    assert.deepEqual(trace.updates, [true])
    assert.deepEqual(trace.persists, [{ id: 'ui-goal', disabled: true }])
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
    assert.deepEqual(trace.persists, [{ id: 'ui-goal', disabled: true }])
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
