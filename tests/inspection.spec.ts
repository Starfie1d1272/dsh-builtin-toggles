import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { evaluateCompatibility, type RuntimeCompositionIdentity, type RuntimeEntryEvidence } from '../src/compatibility.ts'
import { REVIEWED_DSH_WEB_BASELINE, type ReviewedCapabilityBaseline } from '../src/evidence.ts'
import { buildInspectionResponse, INSPECTION_SCHEMA_VERSION, type InspectionRuntimeEntry } from '../src/inspection.ts'
import { MANAGEABLE_IDS } from '../src/policy.ts'
import type { ProfileInspectionSnapshot, ProfileMutationPreflight, ProfileOverrideInspection } from '../src/profile-patch.ts'

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
    declaredInject: null, declaredInjectKnown: true, ownDisabled: undefined,
    compositionScope: 'host',
    ...overrides,
    scopeId: overrides.scopeId ?? (overrides.id ?? 'ui-goal'),
  }
}

function profile(ids: readonly string[], overrides = new Map<string, ProfileOverrideInspection>(), persistence = new Map<string, ProfileMutationPreflight>()): ProfileInspectionSnapshot {
  return {
    profileOverrides: new Map(ids.map((id) => [id, overrides.get(id) ?? { state: 'inherited' as const }])),
    profilePersistence: new Map(ids.map((id) => [id, persistence.get(id) ?? { status: 'writable' as const }])),
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

  it('marks a trustworthy non-rc.6 runtime identity as drift even when structure temporarily matches', () => {
    const result = evaluateCompatibility([runtime()], oneBaseline, {
      kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.7', source: 'host-runtime-metadata',
    })
    assert.equal(result.status, 'drifted')
    assert.equal(result.runtimeIdentity.status, 'mismatched')
    assert.equal(result.findings[0]?.code, 'runtime_release_identity_mismatch')
    // Composition mismatch is not counted as a fake entry-level difference.
    assert.deepEqual({ verified: result.verifiedCount, drifted: result.driftedCount, unverified: result.unverifiedCount }, { verified: 0, drifted: 0, unverified: 1 })
  })

  it('marks directly observed structural drift even when release identity is unavailable', () => {
    const result = evaluateCompatibility([runtime({ packageName: '@deepseek-ai/dsh-client-ui-goal-v2' })], oneBaseline)
    assert.equal(result.status, 'drifted')
    assert.ok(result.findings.some((finding) => finding.code === 'package_identity_changed'))
    assert.deepEqual({ verified: result.verifiedCount, drifted: result.driftedCount, unverified: result.unverifiedCount }, { verified: 0, drifted: 1, unverified: 0 })
  })

  it('keeps a new official entry inspectable but marks the composition drifted', () => {
    const result = evaluateCompatibility([runtime(), runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' })], oneBaseline, reviewedRc6Identity)
    assert.equal(result.status, 'drifted')
    assert.deepEqual(result.findings[0], { scope: 'entry', code: 'new_official_entry', id: 'ui-future', observed: '@deepseek-ai/dsh-client-ui-future' })
  })

  function rc6Augmentations(variant: 'browse' | 'native' = 'browse', ids = ['opaque-host', 'opaque-client', 'opaque-hmr']): RuntimeEntryEvidence[] {
    return [
      runtime({ id: ids[0]!, packageName: `@deepseek-ai/dsh-host-directory-picker-${variant}` }),
      runtime({ id: ids[1]!, packageName: `@deepseek-ai/dsh-client-ui-directory-picker-${variant}` }),
      runtime({ id: ids[2]!, packageName: '@deepseek-ai/cordis-plugin-hmr' }),
    ]
  }

  it('accepts reviewed rc.6 augmentation shape with arbitrary opaque Loader ids', () => {
    for (const entries of [
      [runtime(), ...rc6Augmentations('browse', ['random-a', 'random-b', 'random-c'])],
      [runtime(), ...rc6Augmentations('native', ['different-a', 'different-b', 'different-c'])],
      [runtime(), ...rc6Augmentations('browse', ['fresh-a', 'fresh-b', 'unused-hmr']).slice(0, 2)],
    ]) {
      const result = evaluateCompatibility(entries, oneBaseline, reviewedRc6Identity)
      assert.equal(result.status, 'verified')
      assert.deepEqual(result.findings, [])
    }
  })

  it('drifts on duplicate, missing, extra, or platform-inconsistent augmentation shape', () => {
    const cases = [
      [runtime(), ...rc6Augmentations(), runtime({ id: 'another-hmr', packageName: '@deepseek-ai/cordis-plugin-hmr' })],
      [runtime(), ...rc6Augmentations().filter((_, index) => index !== 1)],
      [runtime(), ...rc6Augmentations(), runtime({ id: 'another-host', packageName: '@deepseek-ai/dsh-host-directory-picker-browse' })],
      [runtime(), ...rc6Augmentations('browse').slice(0, 1), ...rc6Augmentations('native').slice(1)],
    ]
    for (const entries of cases) {
      const result = evaluateCompatibility(entries, oneBaseline, reviewedRc6Identity)
      assert.equal(result.status, 'drifted')
      assert.ok(result.findings.some((finding) => finding.code === 'runtime_augmentation_shape_changed'))
    }
  })

  it('keeps unknown official packages and baseline-id collisions fail closed', () => {
    const unknown = evaluateCompatibility([
      runtime(), ...rc6Augmentations(),
      runtime({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future' }),
    ], oneBaseline, reviewedRc6Identity)
    assert.ok(unknown.findings.some((finding) => finding.code === 'new_official_entry'))

    const collision = evaluateCompatibility([
      runtime(),
      runtime({ id: 'ui-goal', packageName: '@deepseek-ai/dsh-host-directory-picker-browse' }),
      ...rc6Augmentations(),
    ], oneBaseline, reviewedRc6Identity)
    assert.equal(collision.status, 'drifted')
    assert.ok(collision.findings.some((finding) => finding.code === 'runtime_augmentation_id_conflicts_baseline'))
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

describe('scoped composition model (rc.6 Host + Agent Preset)', () => {
  /** Every reviewed id as a Host-plane row in the profile include tree. */
  function hostFixture(): RuntimeEntryEvidence[] {
    return REVIEWED_DSH_WEB_BASELINE.map((entry) => ({
      id: entry.id,
      packageName: entry.expectedPackageName!,
      declaredInject: entry.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')?.expectedServices ?? null,
      scopeId: `include:${entry.id}`,
      compositionScope: 'host' as const,
    }))
  }

  /** The shipped standard preset: rows mirroring Host ids plus preset-only rows. */
  const STANDARD_PRESET_ROWS: readonly { id: string; packageName: string }[] = [
    { id: 'persona', packageName: '@deepseek-ai/dsh-persona' },
    { id: 'agent-instructions', packageName: '@deepseek-ai/dsh-agent-instructions' },
    { id: 'tool-bash', packageName: '@deepseek-ai/dsh-tool-bash' },
    { id: 'tool-pwsh', packageName: '@deepseek-ai/dsh-tool-pwsh' },
    { id: 'tool-fs', packageName: '@deepseek-ai/dsh-tool-fs' },
    { id: 'tool-jobs', packageName: '@deepseek-ai/dsh-tool-jobs' },
    { id: 'plan-mode', packageName: '@deepseek-ai/dsh-plan-mode' },
    { id: 'tool-subagent', packageName: '@deepseek-ai/dsh-tool-subagent' },
    { id: 'tool-ask-user', packageName: '@deepseek-ai/dsh-tool-ask-user' },
  ]

  function presetFixture(): RuntimeEntryEvidence[] {
    return STANDARD_PRESET_ROWS.map((row) => ({
      id: row.id,
      packageName: row.packageName,
      declaredInject: null,
      scopeId: `include:agent-presets:${row.id}`,
      compositionScope: 'agent-preset' as const,
    }))
  }

  function responseFor(entries: readonly RuntimeEntryEvidence[]): ReturnType<typeof buildInspectionResponse> {
    return buildInspectionResponse(
      entries.map((entry) => inspected({
        id: entry.id, name: entry.packageName,
        scopeId: entry.scopeId!, compositionScope: entry.compositionScope!,
        declaredInject: entry.declaredInject,
      })),
      null,
      profile(entries.map((entry) => entry.id)),
      'allowed',
    )
  }

  it('does not drift on legal cross-scope same ids between Host and a standard Agent Preset', () => {
    const result = evaluateCompatibility([...hostFixture(), ...presetFixture()], REVIEWED_DSH_WEB_BASELINE)
    assert.equal(result.runtimeIdentity.status, 'unavailable')
    assert.equal(result.status, 'unverified')
    assert.equal(result.driftedCount, 0)
    assert.equal(result.findings.some((finding) => finding.code === 'duplicate_runtime_id'), false)
    assert.equal(result.findings.some((finding) => finding.code === 'new_official_entry'), false)
  })

  it('keeps the nine reviewed manageable UI leaves eligible under the normal composition', () => {
    const response = responseFor([...hostFixture(), ...presetFixture()])
    assert.equal(response.compatibility.status, 'unverified')
    assert.equal(response.compatibility.driftedCount, 0)
    for (const id of MANAGEABLE_IDS) {
      const leaf = response.capabilities.find((capability) => capability.id === id)!
      assert.equal(leaf.compositionScope, 'host')
      assert.equal(leaf.mutationEligibility.status, 'eligible', `${id} must stay eligible`)
      assert.deepEqual(leaf.mutationEligibility.reasons, [], `${id} reasons`)
    }
  })

  it('attributes preset rows to the agent-preset composition scope and never makes them manageable', () => {
    const response = responseFor([...hostFixture(), ...presetFixture()])
    const presetRow = response.capabilities.find((capability) => capability.id === 'tool-bash' && capability.compositionScope === 'agent-preset')!
    assert.equal(presetRow.scopeId, 'include:agent-presets:tool-bash')
    assert.equal(presetRow.policy.status, 'locked')
    assert.equal(presetRow.policy.reason, 'agent-preset')
    assert.equal(presetRow.verification, 'unverified')
    assert.equal(presetRow.managementPlane, 'agent-preset')
    assert.equal(presetRow.configuration.agentPresetManaged, true)
    assert.equal(presetRow.configuration.profileOverride.state, 'not-applicable')
    assert.equal(presetRow.configuration.profilePersistence.status, 'not-applicable')
    assert.equal(presetRow.mutationEligibility.status, 'ineligible')
    assert.ok(presetRow.mutationEligibility.reasons.includes('agent_preset_scope'))
    const persona = response.capabilities.find((capability) => capability.id === 'persona')!
    assert.equal(persona.compositionScope, 'agent-preset')
    assert.equal(persona.baseline.reviewed, false)
    assert.equal(persona.policy.status, 'locked')
  })

  it('never lets a preset row borrow an allowlisted Host row policy, profile state, or eligibility', () => {
    // A hostile/future preset composing an allowlisted id must not surface the
    // Host row's manageability on the preset card: the DTO locks it at the
    // server before the client ever sees it.
    const host = hostFixture()
    const presetUiGoal = {
      id: 'ui-goal',
      packageName: '@deepseek-ai/dsh-client-ui-goal',
      declaredInject: null,
      scopeId: 'include:agent-presets:ui-goal',
      compositionScope: 'agent-preset' as const,
    }
    const response = responseFor([...host, presetUiGoal])
    const presetRow = response.capabilities.find((capability) => capability.id === 'ui-goal' && capability.compositionScope === 'agent-preset')!
    assert.equal(presetRow.policy.status, 'locked')
    assert.equal(presetRow.policy.reason, 'agent-preset')
    assert.equal(presetRow.mutationEligibility.status, 'ineligible')
    assert.deepEqual(presetRow.mutationEligibility.reasons, ['agent_preset_scope'])
    assert.deepEqual(presetRow.configuration.profileOverride, { state: 'not-applicable' })
    assert.deepEqual(presetRow.configuration.profilePersistence, { status: 'not-applicable' })
    assert.equal(presetRow.verification, 'unverified')
    // The Host row of the same id keeps its own manageability projection.
    const hostRow = response.capabilities.find((capability) => capability.id === 'ui-goal' && capability.compositionScope === 'host')!
    assert.equal(hostRow.policy.status, 'manageable')
    assert.equal(hostRow.mutationEligibility.status, 'eligible')
  })

  it('still drifts and fails mutation closed on a genuine same-scope duplicate', () => {
    const host = hostFixture()
    const bash = host.find((entry) => entry.id === 'tool-bash')!
    host.push({ ...bash }) // same scopeId → same Loader namespace slot
    const result = evaluateCompatibility(host, REVIEWED_DSH_WEB_BASELINE)
    assert.equal(result.status, 'drifted')
    assert.ok(result.findings.some((finding) => finding.code === 'duplicate_runtime_id' && finding.id === 'tool-bash'))
    const response = responseFor(host)
    const goal = response.capabilities.find((capability) => capability.id === 'ui-goal')!
    assert.equal(goal.mutationEligibility.status, 'ineligible')
    assert.ok(goal.mutationEligibility.reasons.includes('global_structural_drift'))
  })

  it('drifts when two Host-plane entries claim the same bare id across different trees', () => {
    const host = hostFixture()
    host.push({ id: 'tool-bash', packageName: '@deepseek-ai/dsh-tool-bash', declaredInject: null, scopeId: 'custom:tool-bash', compositionScope: 'host' })
    const result = evaluateCompatibility(host, REVIEWED_DSH_WEB_BASELINE)
    assert.equal(result.status, 'drifted')
    assert.ok(result.findings.some((finding) => finding.code === 'duplicate_runtime_id' && finding.id === 'tool-bash'))
    // The duplicate row is ambiguous for the baseline; the reviewed id is
    // skipped rather than silently matched to either instance.
    assert.equal(result.findings.filter((finding) => finding.id === 'tool-bash').length, 1)
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
    const entries = [
      inspected(),
      inspected({ id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future', phase: null }),
      inspected({ id: 'third-party', name: '@example/plugin', disabled: true, phase: 'failed' }),
    ]
    const response = buildInspectionResponse(entries, null, profile(entries.map((entry) => entry.id)), 'allowed')
    assert.equal(response.schemaVersion, INSPECTION_SCHEMA_VERSION)
    assert.deepEqual(response.access, { mutation: 'allowed' })
    assert.deepEqual(response.host, { plugin: 'builtin-toggles', profile: 'web' })
    assert.equal(response.inventory.totalEntries, 3)
    assert.equal(response.inventory.officialEntries, 2)
    assert.equal(response.inventory.externalEntries, 1)
    assert.equal(response.compatibility.runtimeIdentity.status, 'unavailable')
    assert.deepEqual(response.capabilities[0]?.runtimeState, { disabled: false, lifecycle: 'active' })
    assert.deepEqual(response.capabilities[0]?.configuration, {
      profileOverride: { state: 'inherited' }, profilePersistence: { status: 'writable' }, effectiveDisabled: false, agentPresetManaged: false,
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
    const entries = [
      inspected({ disabled: true, ownDisabled: true }),
      inspected({ id: 'plan-mode', name: '@deepseek-ai/dsh-plan-mode', ownDisabled: false }),
    ]
    const response = buildInspectionResponse(entries, null, profile(entries.map((entry) => entry.id), new Map([
      ['ui-goal', { state: 'explicitly-disabled' as const }],
      ['plan-mode', { state: 'explicitly-enabled' as const }],
    ])), 'allowed')
    const goal = response.capabilities.find((entry) => entry.id === 'ui-goal')!
    const plan = response.capabilities.find((entry) => entry.id === 'plan-mode')!
    assert.equal(goal.configuration.profileOverride.state, 'explicitly-disabled')
    assert.equal(goal.configuration.effectiveDisabled, true)
    assert.equal(plan.configuration.profileOverride.state, 'explicitly-enabled')
    assert.equal(plan.configuration.agentPresetManaged, true)
  })

  it('projects a composition identity mismatch as global drift but leaves structurally matching entries unverified', () => {
    const entries = reviewedRc6RuntimeFixture().map((entry) => inspected({ id: entry.id, name: entry.packageName, declaredInject: entry.declaredInject }))
    const response = buildInspectionResponse(entries, {
      kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.7', source: 'host-runtime-metadata',
    }, profile(entries.map((entry) => entry.id)), 'allowed')
    assert.equal(response.compatibility.status, 'drifted')
    assert.deepEqual(
      { verified: response.compatibility.verifiedCount, drifted: response.compatibility.driftedCount, unverified: response.compatibility.unverifiedCount },
      { verified: 0, drifted: 0, unverified: REVIEWED_DSH_WEB_BASELINE.length },
    )
    assert.equal(response.capabilities.find((entry) => entry.id === 'ui-goal')?.verification, 'unverified')
  })

  it('reports an unwritable profile patch as eligibility evidence without changing inherited semantics', () => {
    const entries = reviewedRc6RuntimeFixture().map((entry) => inspected({ id: entry.id, name: entry.packageName }))
    const response = buildInspectionResponse(entries, null, profile(entries.map((entry) => entry.id), new Map([['ui-goal', { state: 'inherited' as const }]]), new Map([['ui-goal', { status: 'unwritable' as const, reason: 'non_literal_disabled' as const }]])), 'allowed')
    const goal = response.capabilities.find((entry) => entry.id === 'ui-goal')!
    assert.deepEqual(goal.configuration.profileOverride, { state: 'inherited' })
    assert.deepEqual(goal.configuration.profilePersistence, { status: 'unwritable', reason: 'non_literal_disabled' })
    assert.equal(goal.mutationEligibility.status, 'ineligible')
    assert.ok(goal.mutationEligibility.reasons.includes('profile_not_persistable'))
  })

  it('fails closed when a caller supplies no provenance for a runtime row', () => {
    const response = buildInspectionResponse([inspected()], null, { profileOverrides: new Map(), profilePersistence: new Map() }, 'allowed')
    assert.deepEqual(response.capabilities[0]?.configuration.profileOverride, { state: 'unavailable', reason: 'profile_unavailable' })
    assert.deepEqual(response.capabilities[0]?.configuration.profilePersistence, { status: 'unwritable', reason: 'profile_patch_unreadable' })
    assert.equal(response.capabilities[0]?.mutationEligibility.status, 'ineligible')
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
