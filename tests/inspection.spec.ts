import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateCompatibility, type RuntimeCompositionIdentity, type RuntimeEntryEvidence } from '../src/compatibility.ts'
import { REVIEWED_DSH_WEB_BASELINE, type ReviewedCapabilityBaseline } from '../src/evidence.ts'
import { buildInspectionResponse, INSPECTION_SCHEMA_VERSION, type InspectionRuntimeEntry } from '../src/inspection.ts'
import { MANAGEABLE_IDS } from '../src/policy.ts'

const oneBaseline: readonly ReviewedCapabilityBaseline[] = [{
  id: 'ui-goal',
  expectedPackageName: '@deepseek-ai/dsh-client-ui-goal',
  managementPlane: 'browser',
  category: 'presentation',
  serviceEvidence: [],
  dependencyEvidence: { provides: { status: 'unknown' }, consumers: { status: 'unknown' } },
  leafReview: 'reviewed-safe-ui-leaf',
  reviewedReference: null,
  rationale: 'reviewed test fixture',
}]

const reviewedRc6Identity: RuntimeCompositionIdentity = {
  kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.6', source: 'host-runtime-metadata',
}

function runtime(overrides: Partial<RuntimeEntryEvidence> = {}): RuntimeEntryEvidence {
  return { id: 'ui-goal', packageName: '@deepseek-ai/dsh-client-ui-goal', declaredInject: null, ...overrides }
}

function inspected(overrides: Partial<InspectionRuntimeEntry> = {}): InspectionRuntimeEntry {
  return {
    id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active',
    declaredInject: null, declaredInjectKnown: true, ownDisabled: undefined, ...overrides,
  }
}

function reviewedRc6RuntimeFixture(): RuntimeEntryEvidence[] {
  return REVIEWED_DSH_WEB_BASELINE.map((entry) => ({
    id: entry.id,
    packageName: entry.expectedPackageName!,
    declaredInject: entry.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')?.expectedServices ?? null,
  }))
}

describe('compatibility evaluation', () => {
  it('reports a fully known matching baseline as verified', () => {
    const result = evaluateCompatibility([runtime()], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'verified')
    assert.deepEqual(result.findings, [])
  })

  it('verifies the reviewed rc.6 package-patch composition fixture', () => {
    const result = evaluateCompatibility(reviewedRc6RuntimeFixture(), REVIEWED_DSH_WEB_BASELINE, reviewedRc6Identity)
    assert.equal(result.status, 'verified')
    assert.deepEqual(result.findings, [])
  })

  it('does not verify a matching roster when the runtime release identity is unavailable', () => {
    const result = evaluateCompatibility([runtime()], oneBaseline)
    assert.equal(result.status, 'unverified')
    assert.deepEqual(result.runtimeIdentity.status, 'unavailable')
    assert.equal(result.verifiedCount, 0)
    assert.deepEqual(result.findings, [{
      scope: 'composition', code: 'runtime_release_identity_unavailable',
      expected: { kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.6', provenance: 'npm-published-package' }, observed: null,
    }])
  })

  it('does not verify a non-rc.6 release even when the structure temporarily matches', () => {
    const result = evaluateCompatibility([runtime()], oneBaseline, {
      kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.7', source: 'host-runtime-metadata',
    })
    assert.equal(result.status, 'unverified')
    assert.equal(result.runtimeIdentity.status, 'mismatched')
    assert.equal(result.findings[0]?.code, 'runtime_release_identity_mismatch')
  })

  it('keeps the summary unverified when release identity is unavailable even if structure differs', () => {
    const result = evaluateCompatibility([runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-v2' })], oneBaseline)
    assert.equal(result.status, 'unverified')
    assert.ok(result.findings.some((finding) => finding.code === 'package_identity_changed'))
  })

  it('keeps a new official entry inspectable but marks the composition drifted', () => {
    const result = evaluateCompatibility([runtime(), runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' })], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'drifted')
    assert.deepEqual(result.findings[0], { scope: 'entry', code: 'new_official_entry', id: 'ui-future', observed: '@deepseek-ai/dsh-client-ui-future' })
  })

  it('detects an expected entry missing', () => {
    const result = evaluateCompatibility([], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'drifted')
    assert.equal(result.findings[0]?.code, 'missing_expected_entry')
  })

  it('detects package identity drift', () => {
    const result = evaluateCompatibility([runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-v2' })], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'drifted')
    assert.equal(result.findings[0]?.code, 'package_identity_changed')
  })

  it('reports duplicate Loader ids instead of silently selecting a last entry', () => {
    const result = evaluateCompatibility([runtime(), runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-copy' })], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'drifted')
    assert.deepEqual(result.findings, [{
      scope: 'entry', code: 'duplicate_runtime_id', id: 'ui-goal',
      observed: ['@deepseek-ai/dsh-client-ui-goal', '@deepseek-ai/dsh-client-ui-goal-copy'],
    }])
  })

  it('treats Loader inject string arrays as order-insensitive service sets', () => {
    const baseline = [{ ...oneBaseline[0]!, serviceEvidence: [{ kind: 'declared-inject' as const, expectedServices: ['one', 'two'] }] }]
    const result = evaluateCompatibility([runtime({ declaredInject: ['two', 'one'] })], baseline, reviewedRc6Identity)
    assert.equal(result.status, 'verified')
  })

  it('reports incomplete reviewed evidence as unverified instead of claiming certainty', () => {
    const baseline = [{ ...oneBaseline[0]!, expectedPackageName: null }]
    const result = evaluateCompatibility([runtime()], baseline, reviewedRc6Identity)
    assert.equal(result.status, 'unverified')
    assert.equal(result.findings[0]?.code, 'baseline_package_unknown')
  })
})

describe('reviewed baseline invariants', () => {
  it('has unique ids and sufficient reviewed evidence for every currently manageable id', () => {
    assert.equal(new Set(REVIEWED_DSH_WEB_BASELINE.map((entry) => entry.id)).size, REVIEWED_DSH_WEB_BASELINE.length)
    for (const id of MANAGEABLE_IDS) {
      const entry = REVIEWED_DSH_WEB_BASELINE.find((candidate) => candidate.id === id)
      assert.ok(entry, `${id} must be part of the reviewed baseline`)
      assert.ok(entry.expectedPackageName, `${id} needs a package identity before any future mutation verification`)
      assert.equal(entry.leafReview, 'reviewed-safe-ui-leaf', `${id} needs a reviewed safe-leaf conclusion`)
      assert.ok(entry.reviewedReference, `${id} needs reviewed provenance`)
    }
  })

  it('records the safe UI leaves and ui-commands dependency evidence without policy coupling', () => {
    const safeLeaves = REVIEWED_DSH_WEB_BASELINE.filter((entry) => entry.leafReview === 'reviewed-safe-ui-leaf')
    assert.equal(safeLeaves.length, 9)
    const commands = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'ui-commands')!
    assert.deepEqual(commands.dependencyEvidence, {
      provides: { status: 'observed', services: ['commandUi'] },
      consumers: { status: 'observed', ids: ['ui-conversation', 'ui-model-selection', 'ui-permission'] },
    })
    assert.equal(commands.leafReview, 'locked-dependency')
  })

  it('uses explicit reviewed management-plane mappings and leaves unsupported claims unknown', () => {
    assert.equal(REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'plan-mode')?.managementPlane, 'agent-preset')
    assert.equal(REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'agent')?.managementPlane, 'unknown')
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
    assert.equal(response.compatibility.runtimeIdentity.status, 'unavailable')
    assert.deepEqual(response.capabilities[0]?.runtimeState, { disabled: false, lifecycle: 'active' })
    assert.deepEqual(response.capabilities[0]?.configuration, {
      profileOverride: { state: 'inherited' }, effectiveDisabled: false, agentPresetManaged: false,
    })
    // The partial fixture intentionally lacks the rest of the frozen roster,
    // so mutation is refused while read-only inspection remains available.
    assert.equal(response.capabilities[0]?.mutationEligibility.status, 'ineligible')
    const unknown = response.capabilities.find((capability) => capability.id === 'ui-future')!
    assert.equal(unknown.official, true)
    assert.equal(unknown.baseline.reviewed, false)
    assert.equal(unknown.policy.status, 'locked')
    assert.equal(unknown.verification, 'unverified')
    assert.equal(unknown.managementPlane, 'unknown')
    assert.equal(response.capabilities[0]?.verification, 'unverified')
    assert.equal(response.capabilities.some((capability) => 'title' in capability), false)
  })

  it('reports an explicit profile override separately from effective runtime and Agent Preset ownership', () => {
    const response = buildInspectionResponse([
      inspected({ disabled: true, ownDisabled: true }),
      inspected({ id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', ownDisabled: false }),
    ], null, new Map([
      ['ui-goal', { state: 'explicitly-disabled' as const }],
      ['plan-mode', { state: 'explicitly-enabled' as const }],
    ]))
    const goal = response.capabilities.find((entry) => entry.id === 'ui-goal')!
    const plan = response.capabilities.find((entry) => entry.id === 'plan-mode')!
    assert.equal(goal.configuration.profileOverride.state, 'explicitly-disabled')
    assert.equal(goal.configuration.effectiveDisabled, true)
    assert.equal(plan.configuration.profileOverride.state, 'explicitly-enabled')
    assert.equal(plan.configuration.agentPresetManaged, true)
  })

  it('exposes reviewed evidence independently from the existing policy projection', () => {
    assert.ok(REVIEWED_DSH_WEB_BASELINE.length > 100)
    const goal = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === 'ui-goal')!
    assert.equal(goal.expectedPackageName, '@deepseek-ai/dsh-client-ui-goal')
    assert.equal(goal.managementPlane, 'browser')
    assert.equal(goal.leafReview, 'reviewed-safe-ui-leaf')
    assert.deepEqual(goal.reviewedReference, {
      source: 'npm-published-patch', packageName: '@deepseek-ai/dsh-web-app', version: '0.1.0-rc.6', artifact: 'cordis.patch.yml',
    })
  })
})
