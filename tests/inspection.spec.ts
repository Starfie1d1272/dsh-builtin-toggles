import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateCompatibility, type RuntimeEntryEvidence } from '../src/compatibility.ts'
import { REVIEWED_DSH_WEB_BASELINE, type ReviewedCapabilityBaseline } from '../src/evidence.ts'
import { buildInspectionResponse, INSPECTION_SCHEMA_VERSION, type InspectionRuntimeEntry } from '../src/inspection.ts'

const oneBaseline: readonly ReviewedCapabilityBaseline[] = [{
  id: 'ui-goal',
  expectedPackageName: '@deepseek-ai/dsh-client-ui-goal',
  managementPlane: 'browser',
  category: 'presentation',
  documentedPolicyStatus: 'manageable',
  serviceEvidence: [],
  reviewedReference: null,
  rationale: 'reviewed test fixture',
}]

function runtime(overrides: Partial<RuntimeEntryEvidence> = {}): RuntimeEntryEvidence {
  return { id: 'ui-goal', packageName: '@deepseek-ai/dsh-client-ui-goal', declaredInject: null, ...overrides }
}

function inspected(overrides: Partial<InspectionRuntimeEntry> = {}): InspectionRuntimeEntry {
  return { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active', declaredInject: null, ...overrides }
}

describe('compatibility evaluation', () => {
  it('reports a fully known matching baseline as verified', () => {
    const result = evaluateCompatibility([runtime()], oneBaseline)
    assert.equal(result.status, 'verified')
    assert.deepEqual(result.findings, [])
  })

  it('keeps a new official entry inspectable but marks the composition drifted', () => {
    const result = evaluateCompatibility([runtime(), runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' })], oneBaseline)
    assert.equal(result.status, 'drifted')
    assert.deepEqual(result.findings[0], { code: 'new_official_entry', id: 'ui-future', observed: '@deepseek-ai/dsh-client-ui-future' })
  })

  it('detects an expected entry missing', () => {
    const result = evaluateCompatibility([], oneBaseline)
    assert.equal(result.status, 'drifted')
    assert.equal(result.findings[0]?.code, 'missing_expected_entry')
  })

  it('detects package identity drift', () => {
    const result = evaluateCompatibility([runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-v2' })], oneBaseline)
    assert.equal(result.status, 'drifted')
    assert.equal(result.findings[0]?.code, 'package_identity_changed')
  })

  it('reports incomplete reviewed evidence as unverified instead of claiming certainty', () => {
    const baseline = [{ ...oneBaseline[0]!, expectedPackageName: null }]
    const result = evaluateCompatibility([runtime()], baseline)
    assert.equal(result.status, 'unverified')
    assert.equal(result.findings[0]?.code, 'baseline_package_unknown')
  })
})

describe('inspection API v1 DTO', () => {
  it('is versioned, semantic, and includes unknown entries without granting a mutation authority', () => {
    const response = buildInspectionResponse([
      inspected(),
      inspected({ id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future', phase: null }),
      inspected({ id: 'third-party', name: '@example/plugin', disabled: true, phase: 'failed' }),
    ])
    assert.equal(response.schemaVersion, INSPECTION_SCHEMA_VERSION)
    assert.deepEqual(response.host, { plugin: 'builtin-toggles', profile: 'web' })
    assert.equal(response.inventory.totalEntries, 3)
    assert.equal(response.inventory.officialEntries, 2)
    assert.equal(response.inventory.externalEntries, 1)
    assert.deepEqual(response.capabilities[0]?.runtimeState, { disabled: false, lifecycle: 'active' })
    const unknown = response.capabilities.find((capability) => capability.id === 'ui-future')!
    assert.equal(unknown.official, true)
    assert.equal(unknown.baseline.reviewed, false)
    assert.equal(unknown.policy.status, 'locked')
    assert.equal(unknown.verification, 'unverified')
    assert.equal(unknown.managementPlane, 'unknown')
    assert.equal(response.capabilities.some((capability) => 'title' in capability), false)
  })

  it('keeps the shipped baseline machine-readable and independent of presentation metadata', () => {
    assert.ok(REVIEWED_DSH_WEB_BASELINE.length > 100)
    const goal = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'ui-goal')!
    assert.equal(goal.expectedPackageName, '@deepseek-ai/dsh-client-ui-goal')
    assert.equal(goal.managementPlane, 'browser')
    assert.equal(goal.documentedPolicyStatus, 'manageable')
    assert.deepEqual(goal.reviewedReference, {
      source: 'npm-published-patch', packageName: '@deepseek-ai/dsh-web-app', version: '0.1.0-rc.6', artifact: 'cordis.patch.yml',
    })
  })
})
