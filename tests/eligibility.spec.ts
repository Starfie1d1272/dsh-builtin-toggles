import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateMutationEligibility } from '../src/eligibility.ts'
import { REVIEWED_DSH_WEB_BASELINE } from '../src/evidence.ts'
import { evaluateCompatibility, type RuntimeEntryEvidence } from '../src/compatibility.ts'

const goal = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'ui-goal')!
const baseline = [goal]

function runtime(overrides: Partial<RuntimeEntryEvidence> = {}): RuntimeEntryEvidence {
  return {
    id: 'ui-goal', packageName: '@deepseek-ai/dsh-client-ui-goal',
    declaredInject: null, declaredInjectKnown: true, ...overrides,
  }
}

describe('per-entry mutation eligibility', () => {
  it('permits an exact reviewed safe leaf while runtime identity remains unavailable', () => {
    const result = evaluateMutationEligibility('ui-goal', [runtime()], baseline)
    assert.equal(result.status, 'eligible')
    assert.deepEqual(result.reasons, [])
    assert.ok(result.limitations.includes('runtime_identity_unavailable'))
    assert.ok(result.limitations.includes('consumer_graph_not_exposed'))
  })

  it('rejects an exact-id package mismatch', () => {
    const result = evaluateMutationEligibility('ui-goal', [runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-v2' })], baseline)
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('target_structural_drift'))
  })

  it('rejects target inject drift and duplicate ids', () => {
    const injectDrift = evaluateMutationEligibility('ui-goal', [runtime({ declaredInject: ['unexpected'] })], baseline)
    assert.ok(injectDrift.reasons.includes('target_structural_drift'))
    const opaqueInject = evaluateMutationEligibility('ui-goal', [runtime({ declaredInjectKnown: false })], baseline)
    assert.ok(opaqueInject.reasons.includes('target_structural_drift'))
    const duplicate = evaluateMutationEligibility('ui-goal', [runtime(), runtime()], baseline)
    assert.ok(duplicate.reasons.includes('target_structural_drift'))
  })

  it('rejects unknown and unreviewed entries before any mutation can be considered', () => {
    const result = evaluateMutationEligibility('ui-future', [runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' })], baseline)
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('not_manageable'))
    assert.ok(result.reasons.includes('reviewed_baseline_missing'))
  })

  it('rejects a leaf when its reviewed-safe-leaf evidence is incomplete', () => {
    const incomplete = [{ ...goal, leafReview: 'not-reviewed' as const }]
    const result = evaluateMutationEligibility('ui-goal', [runtime()], incomplete)
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('reviewed_safe_leaf_evidence_missing'))
  })

  it('fails closed on a genuinely new official structural entry', () => {
    const result = evaluateMutationEligibility('ui-goal', [runtime(), runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' })], baseline)
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('global_structural_drift'))
    assert.ok(result.limitations.includes('consumer_graph_not_exposed'))
  })

  it('rejects a positive release-identity mismatch without making unavailable identity a denial', () => {
    const entries = [runtime()]
    const compatibility = evaluateCompatibility(entries, baseline, {
      kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.999', source: 'host-runtime-metadata',
    })
    const result = evaluateMutationEligibility(
      'ui-goal',
      entries,
      baseline,
      compatibility,
    )
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('runtime_identity_mismatch'))
  })

  it('ignores a same-bare-id Agent Preset row when targeting the Host row', () => {
    const host = runtime({ scopeId: 'include:ui-goal', compositionScope: 'host' })
    const preset = runtime({ scopeId: 'include:agent-presets:ui-goal', compositionScope: 'agent-preset', packageName: '@deepseek-ai/dsh-client-ui-goal' })
    const result = evaluateMutationEligibility('ui-goal', [host, preset], baseline)
    assert.equal(result.status, 'eligible')
    assert.deepEqual(result.reasons, [])
  })

  it('fails closed when two Host-plane entries claim the same bare id', () => {
    const first = runtime({ scopeId: 'include:ui-goal', compositionScope: 'host' })
    const second = runtime({ scopeId: 'custom:ui-goal', compositionScope: 'host' })
    const result = evaluateMutationEligibility('ui-goal', [first, second], baseline)
    assert.equal(result.status, 'ineligible')
    assert.ok(result.reasons.includes('target_structural_drift'))
  })

  it('does not count accepted Agent Preset rows as global structural drift', () => {
    const host = runtime({ scopeId: 'include:ui-goal', compositionScope: 'host' })
    const presetRow = runtime({ id: 'tool-bash', packageName: '@deepseek-ai/dsh-tool-bash', scopeId: 'include:agent-presets:tool-bash', compositionScope: 'agent-preset' })
    const entries = [host, presetRow]
    const result = evaluateMutationEligibility('ui-goal', entries, baseline)
    assert.equal(result.status, 'eligible')
    assert.equal(result.reasons.includes('global_structural_drift'), false)
  })
})
