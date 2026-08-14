/** Browser-only projection of the locale-independent inspection DTO. */

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type MutationAction = 'force-enable' | 'force-disable' | 'restore-inheritance'

export interface CompatibilityFinding {
  scope: 'composition' | 'entry'
  code: string
  id?: string
  expected?: unknown
  observed?: unknown
}

export interface Capability {
  id: string
  packageName: string
  official: boolean
  runtimeState: { disabled: boolean; lifecycle: string }
  configuration: {
    profileOverride: { state: 'inherited' | 'explicitly-enabled' | 'explicitly-disabled' | 'unavailable'; reason?: string }
    profilePersistence: { status: 'writable' | 'unwritable'; reason?: string }
    effectiveDisabled: boolean
    agentPresetManaged: boolean
  }
  managementPlane: string
  category: string
  policy: { status: 'manageable' | 'locked'; reason?: string }
  verification: VerificationStatus
  mutationEligibility: { status: 'eligible' | 'ineligible'; reasons: readonly string[]; limitations: readonly string[] }
  baseline: {
    reviewed: boolean
    expectedPackageName: string | null
    reviewedReference: { source: string; packageName: string; version: string; artifact: string } | null
    serviceEvidence: readonly { kind: string; expectedServices: readonly string[] | null }[]
    dependencyEvidence: { provides: { status: string; services?: readonly string[] }; consumers: { status: string; ids?: readonly string[] } } | null
    leafReview: string | null
    rationale: string | null
  }
}

export interface InspectionSnapshot {
  schemaVersion: string
  compatibility: {
    status: VerificationStatus
    runtimeIdentity: { status: string; expected: { value: string }; observed: { value: string } | null }
    findings: readonly CompatibilityFinding[]
    verifiedCount: number
    driftedCount: number
    unverifiedCount: number
  }
  inventory: { totalEntries: number; officialEntries: number; externalEntries: number; reviewedEntries: number }
  capabilities: readonly Capability[]
}

export interface InspectorFilters {
  query: string
  category: string
  managementPlane: string
  policy: string
  verification: string
  runtime: string
  anomaliesOnly: boolean
}

export const EMPTY_FILTERS: InspectorFilters = {
  query: '', category: 'all', managementPlane: 'all', policy: 'all', verification: 'all', runtime: 'all', anomaliesOnly: false,
}

export function capabilityHasAnomaly(capability: Capability, snapshot: InspectionSnapshot): boolean {
  return capability.verification !== 'verified'
    || !capability.baseline.reviewed
    || !capability.official
    || snapshot.compatibility.findings.some((finding) => finding.id === capability.id)
}

export function filterCapabilities(snapshot: InspectionSnapshot, filters: InspectorFilters): Capability[] {
  const query = filters.query.trim().toLowerCase()
  return snapshot.capabilities.filter((capability) => {
    if (query && ![capability.id, capability.packageName, capability.category, capability.managementPlane].join(' ').toLowerCase().includes(query)) return false
    if (filters.category !== 'all' && capability.category !== filters.category) return false
    if (filters.managementPlane !== 'all' && capability.managementPlane !== filters.managementPlane) return false
    if (filters.policy !== 'all' && capability.policy.status !== filters.policy) return false
    if (filters.verification !== 'all' && capability.verification !== filters.verification) return false
    if (filters.runtime !== 'all' && capability.runtimeState.lifecycle !== filters.runtime) return false
    return !filters.anomaliesOnly || capabilityHasAnomaly(capability, snapshot)
  })
}

/** A deliberately allowlisted, local-path-free diagnostic report. */
export function buildDiagnostics(snapshot: InspectionSnapshot): string {
  const compatibility = snapshot.compatibility
  const lines = [
    'dsh-builtin-toggles capability inspector',
    `schemaVersion: ${snapshot.schemaVersion}`,
    `compatibility: ${compatibility.status}`,
    `runtimeIdentity: ${compatibility.runtimeIdentity.status}`,
    `inventory: total=${snapshot.inventory.totalEntries}, official=${snapshot.inventory.officialEntries}, external=${snapshot.inventory.externalEntries}, reviewed=${snapshot.inventory.reviewedEntries}`,
    'findings:',
    ...compatibility.findings.map((finding) => `- ${finding.scope}:${finding.code}${finding.id === undefined ? '' : ` (${finding.id})`}`),
    'capabilities:',
    ...snapshot.capabilities.map((capability) => [
      `- id=${capability.id}`,
      `package=${capability.packageName}`,
      `verification=${capability.verification}`,
      `policy=${capability.policy.status}`,
      `eligibility=${capability.mutationEligibility.status}`,
      `reasons=${capability.mutationEligibility.reasons.join(',') || 'none'}`,
      `limitations=${capability.mutationEligibility.limitations.join(',') || 'none'}`,
    ].join(' ')),
  ]
  return lines.join('\n')
}

export function capabilityFromHash(hash: string): string | null {
  const match = /^#capability=([^&]+)$/.exec(hash)
  if (match === null) return null
  try { return decodeURIComponent(match[1]!) } catch { return null }
}

/** Controls are presentation only; eligibility itself is always server-computed. */
export function availableActions(capability: Capability): readonly MutationAction[] {
  if (capability.mutationEligibility.status !== 'eligible' || capability.configuration.profileOverride.state === 'unavailable') return []
  switch (capability.configuration.profileOverride.state) {
    case 'inherited': return ['force-enable', 'force-disable']
    case 'explicitly-enabled': return ['force-disable', 'restore-inheritance']
    case 'explicitly-disabled': return ['force-enable', 'restore-inheritance']
  }
}
