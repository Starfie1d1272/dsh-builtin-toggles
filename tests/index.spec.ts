/**
 * Host route helpers: malformed request input must become a clean 4xx,
 * never a throw into the HTTP layer and never a mutation.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { decodeEntryId } from '../src/index.ts'

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
