/**
 * Policy tests: the exact explicit allowlist is the only path to
 * manageability. Everything else fails closed.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  classifyEntry,
  LOCKED_IDS,
  MANAGEABLE,
  parseDisabledBody,
  type EntryFacts,
} from '../src/policy.ts'
import { checkMutation } from '../src/policy.ts'

function facts(overrides: Partial<EntryFacts> = {}): EntryFacts {
  return { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active', ...overrides }
}

describe('classifyEntry', () => {
  it('allowlisted official entry → manageable', () => {
    for (const id of MANAGEABLE) {
      const row = classifyEntry(facts({ id, name: `@deepseek-ai/dsh-client-${id.slice(3)}` }))
      assert.equal(row.manageable, true, id)
      assert.equal(row.reason, undefined, id)
    }
  })

  it('allowlisted id + non-@deepseek-ai package → locked (external)', () => {
    const row = classifyEntry(facts({ name: '@evil/ui-goal' }))
    assert.equal(row.manageable, false)
    assert.equal(row.reason, 'external')
  })

  it('allowlisted id + third-party package squatting the id stays locked even without @ scope', () => {
    const row = classifyEntry(facts({ name: 'ui-goal' }))
    assert.equal(row.manageable, false)
    assert.equal(row.reason, 'external')
  })

  it('unknown official id → locked (unlisted)', () => {
    const row = classifyEntry(facts({ id: 'ui-cordis', name: '@deepseek-ai/dsh-client-ui-cordis' }))
    assert.equal(row.manageable, false)
    assert.equal(row.reason, 'unlisted')
  })

  it('explicit core id → locked (core)', () => {
    assert.ok(LOCKED_IDS.has('ui-settings'))
    const row = classifyEntry(facts({ id: 'ui-settings', name: '@deepseek-ai/dsh-client-ui-settings' }))
    assert.equal(row.manageable, false)
    assert.equal(row.reason, 'core')
  })

  it('every LOCKED_IDS entry is also locked by classification', () => {
    for (const id of LOCKED_IDS) {
      const row = classifyEntry(facts({ id, name: `@deepseek-ai/dsh-${id}` }))
      assert.equal(row.manageable, false, id)
      assert.equal(row.reason, 'core', id)
    }
  })

  it('self → locked (self), even with a @deepseek-ai-looking name', () => {
    const row = classifyEntry(facts({ id: 'builtin-toggles', name: 'dsh-builtin-toggles' }))
    assert.equal(row.manageable, false)
    assert.equal(row.reason, 'self')
  })

  it('allowlisted id with an allowlisted-looking but prefixed id stays locked', () => {
    // exact matching: "ui-goal-extra" is not "ui-goal"
    const row = classifyEntry(facts({ id: 'ui-goal-extra', name: '@deepseek-ai/dsh-client-ui-goal-extra' }))
    assert.equal(row.manageable, false)
  })
})

describe('checkMutation (server-side POST gate)', () => {
  it('forbidden id → 403 before anything else', () => {
    const verdict = checkMutation('ui-cordis', facts({ id: 'ui-cordis' }), { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) {
      assert.equal(verdict.status, 403)
      assert.equal(verdict.code, 'not_manageable')
    }
  })

  it('unknown id → 403 even with a matching loader entry', () => {
    const verdict = checkMutation('totally-unknown', facts({ id: 'totally-unknown' }), { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.equal(verdict.status, 403)
  })

  it('invalid body → 400', () => {
    for (const body of [undefined, null, 42, 'x', {}, { disabled: 'yes' }, { disabled: 1 }, [], { disabled: true, extra: 1 }]) {
      const verdict = checkMutation('ui-goal', facts(), body)
      assert.equal(verdict.ok, false, JSON.stringify(body))
      if (!verdict.ok) {
        assert.equal(verdict.status, 400)
        assert.equal(verdict.code, 'invalid_body')
      }
    }
  })

  it('missing loader entry → 404', () => {
    const verdict = checkMutation('ui-goal', undefined, { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) {
      assert.equal(verdict.status, 404)
      assert.equal(verdict.code, 'not_found')
    }
  })

  it('official-id but non-official module → 403 (module check is server-side)', () => {
    const verdict = checkMutation('ui-goal', facts({ name: '@evil/ui-goal' }), { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) {
      assert.equal(verdict.status, 403)
      assert.equal(verdict.code, 'not_official')
    }
  })

  it('self → 403 (allowlist gate fires first; still fail-closed)', () => {
    const verdict = checkMutation('builtin-toggles', facts({ id: 'builtin-toggles', name: 'dsh-builtin-toggles' }), { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.equal(verdict.status, 403)
  })

  it('allowlisted official entry with valid body → ok', () => {
    const verdict = checkMutation('ui-goal', facts(), { disabled: true })
    assert.deepEqual(verdict, { ok: true })
  })
})

describe('parseDisabledBody', () => {
  it('accepts only plain booleans', () => {
    assert.deepEqual(parseDisabledBody({ disabled: true }), { disabled: true })
    assert.deepEqual(parseDisabledBody({ disabled: false }), { disabled: false })
    assert.equal(parseDisabledBody({ disabled: 'true' }), null)
    assert.equal(parseDisabledBody({}), null)
    assert.equal(parseDisabledBody(null), null)
  })
})
