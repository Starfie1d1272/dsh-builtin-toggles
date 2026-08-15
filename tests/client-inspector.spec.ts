import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/locales.ts'
import { getCapabilityPresentation } from '../src/client/presentation.ts'
import { EMPTY_FILTERS, availableActions, buildDiagnostics, capabilityHasAnomaly, deepLinkIndex, filterCapabilities, type Capability, type InspectionSnapshot } from '../src/client/inspector-model.ts'
import { mutateAndRefresh } from '../src/client/inspector-requests.ts'

function capability(overrides: Partial<Capability> = {}): Capability {
  return {
    id: 'ui-goal', packageName: '@deepseek-ai/dsh-client-ui-goal', official: true,
    runtimeState: { disabled: false, lifecycle: 'active' },
    configuration: { profileOverride: { state: 'inherited' }, profilePersistence: { status: 'writable' }, effectiveDisabled: false, agentPresetManaged: false },
    managementPlane: 'browser', category: 'presentation', policy: { status: 'manageable' }, verification: 'unverified',
    mutationEligibility: { status: 'eligible', reasons: [], limitations: ['runtime_identity_unavailable'] },
    baseline: { reviewed: true, expectedPackageName: '@deepseek-ai/dsh-client-ui-goal', reviewedReference: { source: 'npm-published-patch', packageName: '@deepseek-ai/dsh-web-app', version: '0.1.0-rc.6', artifact: 'cordis.patch.yml' }, serviceEvidence: [], dependencyEvidence: null, leafReview: 'reviewed-safe-ui-leaf', rationale: null },
    ...overrides,
  }
}
function snapshot(capabilities: readonly Capability[] = [capability()]): InspectionSnapshot {
  return { schemaVersion: 'builtin-toggles.inspection/v1', access: { mutation: 'allowed' }, inventory: { totalEntries: capabilities.length, officialEntries: capabilities.filter((item) => item.official).length, externalEntries: capabilities.filter((item) => !item.official).length, reviewedEntries: capabilities.filter((item) => item.baseline.reviewed).length }, compatibility: { status: 'unverified', runtimeIdentity: { status: 'unavailable', expected: { value: '@deepseek-ai/dsh@0.1.0-rc.6' }, observed: null }, findings: [{ scope: 'composition', code: 'runtime_release_identity_unavailable' }], verifiedCount: 0, driftedCount: 0, unverifiedCount: capabilities.length }, capabilities }
}

describe('Capability Inspector client model', () => {
  it('keeps an eligible reviewed leaf operable when runtime identity is unavailable', () => {
    assert.deepEqual(availableActions(capability(), snapshot()), ['force-enable', 'force-disable'])
  })
  it('represents all three profile states and never renders controls for unavailable or ineligible rows', () => {
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'explicitly-enabled' } } }), snapshot()), ['force-disable', 'restore-inheritance'])
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'explicitly-disabled' } } }), snapshot()), ['force-enable', 'restore-inheritance'])
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'unavailable' } } }), snapshot()), [])
    assert.deepEqual(availableActions(capability({ mutationEligibility: { status: 'ineligible', reasons: ['global_structural_drift'], limitations: [] } }), snapshot()), [])
  })
  it('does not offer mutation actions to a remote read-only inspection snapshot', () => {
    const remote = snapshot()
    remote.access = { mutation: 'loopback-required' }
    assert.deepEqual(availableActions(capability(), remote), [])
  })
  it('filters broad inspection rows by localized display text, server fields, and real anomalies', () => {
    const all = snapshot([
      capability(),
      capability({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future', policy: { status: 'locked', reason: 'unlisted' }, verification: 'drifted', mutationEligibility: { status: 'ineligible', reasons: ['not_manageable'], limitations: [] }, baseline: { ...capability().baseline, reviewed: false } }),
      capability({ id: 'external', packageName: '@example/plugin', official: false, managementPlane: 'unknown', category: 'unknown', verification: 'unverified', mutationEligibility: { status: 'ineligible', reasons: ['not_manageable'], limitations: [] } }),
      capability({ id: 'plan-mode', managementPlane: 'agent-preset', configuration: { ...capability().configuration, agentPresetManaged: true } }),
    ])
    const zhPresentation = (item: Capability) => getCapabilityPresentation('zh', item)
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, query: 'example/plugin' }, zhPresentation).map((item) => item.id), ['external'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, query: '目标栏' }, zhPresentation).map((item) => item.id), ['ui-goal'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, managementPlane: 'agent-preset' }).map((item) => item.id), ['plan-mode'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, policy: 'locked', verification: 'drifted' }).map((item) => item.id), ['ui-future'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, anomaliesOnly: true }, zhPresentation).map((item) => item.id), ['ui-future'])
  })
  it('does not treat a global unavailable runtime identity or an external capability as an anomaly', () => {
    const healthy = snapshot([capability(), capability({ id: 'external', packageName: '@example/plugin', official: false, verification: 'unverified', policy: { status: 'locked', reason: 'external' }, mutationEligibility: { status: 'ineligible', reasons: ['not_manageable'], limitations: [] } })])
    assert.equal(capabilityHasAnomaly(healthy.capabilities[0]!, healthy), false)
    assert.equal(capabilityHasAnomaly(healthy.capabilities[1]!, healthy), false)
    assert.deepEqual(filterCapabilities(healthy, { ...EMPTY_FILTERS, anomaliesOnly: true }).map((item) => item.id), [])
  })
  it('keeps a structurally matching reviewed capability out of anomalies-only when only composition identity mismatches', () => {
    const inspected = snapshot([capability({ verification: 'unverified' })])
    inspected.compatibility = {
      ...inspected.compatibility,
      status: 'drifted',
      runtimeIdentity: { ...inspected.compatibility.runtimeIdentity, status: 'mismatched', observed: { value: '@deepseek-ai/dsh@0.1.0-rc.7' } },
      findings: [{ scope: 'composition', code: 'runtime_release_identity_mismatch' }],
    }
    assert.equal(capabilityHasAnomaly(inspected.capabilities[0]!, inspected), false)
    assert.deepEqual(filterCapabilities(inspected, { ...EMPTY_FILTERS, anomaliesOnly: true }).map((item) => item.id), [])
  })
  it('marks local drift, review, profile persistence/state, and failed runtime conditions as anomalies', () => {
    const drift = capability({ verification: 'drifted' })
    const unreviewed = capability({ id: 'ui-future', baseline: { ...capability().baseline, reviewed: false } })
    const brokenProfile = capability({ id: 'ui-jobs', configuration: { ...capability().configuration, profileOverride: { state: 'unavailable', reason: 'non_literal_disabled' }, profilePersistence: { status: 'unwritable', reason: 'non_literal_disabled' } } })
    const failed = capability({ id: 'ui-skill', runtimeState: { disabled: false, lifecycle: 'failed' } })
    const localFinding = capability({ id: 'ui-subagent' })
    const inspected = snapshot([drift, unreviewed, brokenProfile, failed, localFinding])
    inspected.compatibility = { ...inspected.compatibility, findings: [...inspected.compatibility.findings, { scope: 'entry', code: 'declared_inject_changed', id: 'ui-subagent' }] }
    assert.deepEqual(filterCapabilities(inspected, { ...EMPTY_FILTERS, anomaliesOnly: true }).map((item) => item.id), ['ui-goal', 'ui-future', 'ui-jobs', 'ui-skill', 'ui-subagent'])
  })
  it('uses locale-aware catalog presentation only for display/search and falls back safely for external rows', () => {
    const known = capability()
    assert.deepEqual(getCapabilityPresentation('zh', known), { title: '目标栏', summary: '在输入区显示当前 Goal，可编辑、暂停、恢复或清除；Goal 仍通过 /goal 创建。', unknown: false })
    assert.deepEqual(getCapabilityPresentation('en', known), { title: 'Goal bar', summary: 'Shows the current Goal near the composer and provides controls to edit, pause, resume, or clear it.', unknown: false })
    assert.deepEqual(getCapabilityPresentation('en', capability({ id: 'ui-goal', packageName: '@example/plugin', official: false })).unknown, true)
    assert.deepEqual(getCapabilityPresentation('en', capability({ id: 'ui-commands', packageName: '@deepseek-ai/dsh-client-ui-commands' })), {
      title: 'dsh-client-ui-commands', summary: 'No reviewed presentation description is available for this capability.', unknown: true,
    })
  })
  it('has equivalent zh-CN/en inspector keys and diagnostics allowlist excludes sensitive local fields', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
    assert.equal(zh.verificationVerified, '已验证')
    assert.equal(zh.verificationDrifted, '已漂移')
    assert.equal(zh.verificationUnverified, '未验证')
    const report = buildDiagnostics(snapshot([capability({ packageName: '@deepseek-ai/dsh-client-ui-goal' })]))
    assert.match(report, /schemaVersion/)
    assert.doesNotMatch(report, /(DSH_HOME|\/Users\/|token|hostname|profile content)/i)
  })

  it('redacts external Loader identifiers and local package spellings from copied diagnostics', () => {
    const external = capability({
      id: 'file:///Users/alice/.dsh/private-plugin?token=secret',
      packageName: 'C:\\Users\\alice\\private-plugin',
      official: false,
      baseline: { ...capability().baseline, reviewed: false, expectedPackageName: null },
    })
    const inspected = snapshot([capability(), external])
    inspected.compatibility = { ...inspected.compatibility, findings: [...inspected.compatibility.findings, {
      scope: 'entry', code: 'duplicate_runtime_id', id: external.id,
    }] }
    const report = buildDiagnostics(inspected)
    assert.match(report, /ui-goal/)
    assert.match(report, /external-or-unreviewed/)
    assert.match(report, /redacted/)
    assert.doesNotMatch(report, /alice|private-plugin|file:\/\/|C:\\Users|secret/i)
  })
  it('resolves a capability deep link to the matching rendered row', () => {
    assert.equal(deepLinkIndex([capability(), capability({ id: 'ui-jobs' })], 'ui-jobs'), 1)
    assert.equal(deepLinkIndex([capability()], 'missing'), -1)
  })
})

describe('Capability Inspector mutation request flow', () => {
  it('uses bounded authoritative follow-up reads after restore and returns the converged state', async () => {
    const transient = snapshot([capability({ configuration: { ...capability().configuration, profileOverride: { state: 'inherited' }, effectiveDisabled: true } })])
    const converged = snapshot([capability({ configuration: { ...capability().configuration, profileOverride: { state: 'inherited' }, effectiveDisabled: false } })])
    const inspections = [transient, converged, converged]
    const calls: string[] = []
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input); calls.push(url)
      const body = url.includes('/v1/inspection') ? inspections.shift()! : { ok: true, id: 'ui-goal', action: 'restore-inheritance', disabled: null, runtimeEffect: 'recomposing', persisted: true }
      return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const actual = await mutateAndRefresh(fetcher, 'ui-goal', 'restore-inheritance', { wait: async () => {}, restoreFollowUpReads: 2 })
    assert.equal(actual.capabilities[0]?.configuration.effectiveDisabled, false)
    assert.deepEqual(calls, ['/api/builtin-toggles/ui-goal', '/api/builtin-toggles/v1/inspection', '/api/builtin-toggles/v1/inspection', '/api/builtin-toggles/v1/inspection'])
  })
})
