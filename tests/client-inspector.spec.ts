import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { en, zh } from '../src/client/locales.ts'
import { EMPTY_FILTERS, availableActions, buildDiagnostics, filterCapabilities, type Capability, type InspectionSnapshot } from '../src/client/inspector-model.ts'
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
  return { schemaVersion: 'builtin-toggles.inspection/v1', inventory: { totalEntries: capabilities.length, officialEntries: capabilities.filter((item) => item.official).length, externalEntries: capabilities.filter((item) => !item.official).length, reviewedEntries: capabilities.filter((item) => item.baseline.reviewed).length }, compatibility: { status: 'unverified', runtimeIdentity: { status: 'unavailable', expected: { value: '@deepseek-ai/dsh@0.1.0-rc.6' }, observed: null }, findings: [{ scope: 'composition', code: 'runtime_release_identity_unavailable' }], verifiedCount: 0, driftedCount: 0, unverifiedCount: capabilities.length }, capabilities }
}

describe('Capability Inspector client model', () => {
  it('keeps an eligible reviewed leaf operable when runtime identity is unavailable', () => {
    assert.deepEqual(availableActions(capability()), ['force-enable', 'force-disable'])
  })
  it('represents all three profile states and never renders controls for unavailable or ineligible rows', () => {
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'explicitly-enabled' } } })), ['force-disable', 'restore-inheritance'])
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'explicitly-disabled' } } })), ['force-enable', 'restore-inheritance'])
    assert.deepEqual(availableActions(capability({ configuration: { ...capability().configuration, profileOverride: { state: 'unavailable' } } })), [])
    assert.deepEqual(availableActions(capability({ mutationEligibility: { status: 'ineligible', reasons: ['global_structural_drift'], limitations: [] } })), [])
  })
  it('filters broad inspection rows by search, server fields, and anomalies', () => {
    const all = snapshot([
      capability(),
      capability({ id: 'ui-future', packageName: '@deepseek-ai/dsh-client-ui-future', policy: { status: 'locked', reason: 'unlisted' }, verification: 'drifted', mutationEligibility: { status: 'ineligible', reasons: ['not_manageable'], limitations: [] }, baseline: { ...capability().baseline, reviewed: false } }),
      capability({ id: 'external', packageName: '@example/plugin', official: false, managementPlane: 'unknown', category: 'unknown', verification: 'unverified', mutationEligibility: { status: 'ineligible', reasons: ['not_manageable'], limitations: [] } }),
      capability({ id: 'plan-mode', managementPlane: 'agent-preset', configuration: { ...capability().configuration, agentPresetManaged: true } }),
    ])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, query: 'example/plugin' }).map((item) => item.id), ['external'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, managementPlane: 'agent-preset' }).map((item) => item.id), ['plan-mode'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, policy: 'locked', verification: 'drifted' }).map((item) => item.id), ['ui-future'])
    assert.deepEqual(filterCapabilities(all, { ...EMPTY_FILTERS, anomaliesOnly: true }).map((item) => item.id), ['ui-goal', 'ui-future', 'external', 'plan-mode'])
  })
  it('has equivalent zh-CN/en inspector keys and diagnostics allowlist excludes sensitive local fields', () => {
    assert.deepEqual(Object.keys(en).sort(), Object.keys(zh).sort())
    const report = buildDiagnostics(snapshot([capability({ packageName: '@deepseek-ai/dsh-client-ui-goal' })]))
    assert.match(report, /schemaVersion/)
    assert.doesNotMatch(report, /(DSH_HOME|\/Users\/|token|hostname|profile content)/i)
  })
})

describe('Capability Inspector mutation request flow', () => {
  it('re-fetches authoritative inspection after a successful restore without predicting transient effective state', async () => {
    const refreshed = snapshot([capability({ configuration: { ...capability().configuration, profileOverride: { state: 'inherited' }, effectiveDisabled: true } })])
    const calls: string[] = []
    const fetcher = (async (input: string | URL | Request) => {
      const url = String(input); calls.push(url)
      return new Response(url.includes('/v1/inspection') ? JSON.stringify(refreshed) : JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch
    const actual = await mutateAndRefresh(fetcher, 'ui-goal', 'restore-inheritance')
    assert.equal(actual.capabilities[0]?.configuration.effectiveDisabled, true)
    assert.deepEqual(calls, ['/api/builtin-toggles/ui-goal', '/api/builtin-toggles/v1/inspection'])
  })
})
