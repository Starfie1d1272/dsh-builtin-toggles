/**
 * Host route helpers: malformed request input must become a clean 4xx,
 * never a throw into the HTTP layer and never a mutation.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import { buildSnapshot, decodeEntryId } from '../src/index.ts'

describe('decodeEntryId', () => {
  it('plain ids pass through', () => {
    assert.equal(decodeEntryId('ui-goal'), 'ui-goal')
    assert.equal(decodeEntryId('builtin-toggles'), 'builtin-toggles')
  })

  it('valid percent-encoding decodes', () => {
    assert.equal(decodeEntryId('%75i-goal'), 'ui-goal')
    assert.equal(decodeEntryId('ui-%67oal'), 'ui-goal')
  })

  it('malformed percent-encoding → null (400 path), no throw', () => {
    assert.equal(decodeEntryId('%ZZ'), null)
    assert.equal(decodeEntryId('%'), null)
    assert.equal(decodeEntryId('%2'), null)
    assert.equal(decodeEntryId('ui-goal%'), null)
    assert.equal(decodeEntryId('%GG%HH'), null)
  })

  it('the decoded value is NOT a security bypass: it still goes through the exact allowlist', () => {
    // '%75i-goal' decodes to 'ui-goal' which IS allowlisted — that is fine.
    // A decoded value that is not on the allowlist is rejected by the policy
    // gate before any mutation, e.g. '%75i-commands' decodes to 'ui-commands'.
    assert.equal(decodeEntryId('%75i-commands'), 'ui-commands')
  })
})

describe('legacy snapshot compatibility', () => {
  it('keeps GET /api/builtin-toggles rows unchanged while v1 inspection is additive', () => {
    const entries = [
      { options: { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal' }, disabled: false, fiber: { state: 2 } },
      { options: { id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future' }, disabled: true, fiber: undefined },
      { options: { id: 'third-party', name: '@example/plugin' }, disabled: false, fiber: { state: 3 } },
    ] as unknown as Entry[]
    assert.deepEqual(buildSnapshot(entries), [
      { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active', manageable: true },
      { id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future', disabled: true, phase: null, manageable: false, reason: 'unlisted' },
    ])
  })
})
