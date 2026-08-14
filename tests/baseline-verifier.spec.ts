import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sameDeclaredInject } from '../scripts/verify-reviewed-baseline.ts'

describe('reviewed baseline inject verifier', () => {
  it('distinguishes an absent declaration from explicit empty inject in both directions', () => {
    assert.equal(sameDeclaredInject(null, []), false)
    assert.equal(sameDeclaredInject([], null), false)
  })

  it('compares explicit inject declarations as order-insensitive sets', () => {
    assert.equal(sameDeclaredInject(['one', 'two'], ['two', 'one']), true)
  })
})
