/** Browser-only projection of the locale-independent inspection DTO. */

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type MutationAction = 'force-enable' | 'force-disable' | 'restore-inheritance'
export type CompositionScope = 'host' | 'agent-preset'

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
  /** Loader-computed identity qualified by the owning-tree entry chain. */
  scopeId: string
  /** Public composition plane (Host vs per-session Agent Preset). */
  compositionScope: CompositionScope
  runtimeState: { disabled: boolean; lifecycle: string }
  configuration: {
    profileOverride: { state: 'inherited' | 'explicitly-enabled' | 'explicitly-disabled' | 'unavailable' | 'not-applicable'; reason?: string }
    profilePersistence: { status: 'writable' | 'unwritable' | 'not-applicable'; reason?: string }
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
  access: { mutation: 'allowed' | 'loopback-required' }
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
  compositionScope: string
  policy: string
  verification: string
  runtime: string
  anomaliesOnly: boolean
}

export interface CapabilityPresentation { title: string; summary: string }
export type PresentationResolver = (capability: Capability) => CapabilityPresentation

export const EMPTY_FILTERS: InspectorFilters = {
  query: '', category: 'all', managementPlane: 'all', compositionScope: 'all', policy: 'all', verification: 'all', runtime: 'all', anomaliesOnly: false,
}

/**
 * Anomalies-only must agree with the compatibility evaluator: a row is an
 * anomaly when the evaluator observed a concrete problem with it, or when its
 * profile/runtime state is broken. An official row without a baseline row is
 * NOT an anomaly by itself — the evaluator explicitly accepts reviewed rc.6
 * runtime augmentations (Host-generated helper ids, per-session Agent Preset
 * rows) that have no published baseline row.
 */
export function capabilityHasAnomaly(capability: Capability, snapshot: InspectionSnapshot): boolean {
  return capability.verification === 'drifted'
    || capability.configuration.profileOverride.state === 'unavailable'
    || capability.configuration.profilePersistence.status === 'unwritable'
    || capability.runtimeState.lifecycle === 'failed'
    || snapshot.compatibility.findings.some((finding) => finding.id === capability.id)
}

export function filterCapabilities(snapshot: InspectionSnapshot, filters: InspectorFilters, presentation?: PresentationResolver): Capability[] {
  const query = filters.query.trim().toLowerCase()
  return snapshot.capabilities.filter((capability) => {
    const display = presentation?.(capability)
    if (query && ![display?.title, display?.summary, capability.id, capability.packageName, capability.category, capability.managementPlane, capability.compositionScope].join(' ').toLowerCase().includes(query)) return false
    if (filters.category !== 'all' && capability.category !== filters.category) return false
    if (filters.managementPlane !== 'all' && capability.managementPlane !== filters.managementPlane) return false
    if (filters.compositionScope !== 'all' && capability.compositionScope !== filters.compositionScope) return false
    if (filters.policy !== 'all' && capability.policy.status !== filters.policy) return false
    if (filters.verification !== 'all' && capability.verification !== filters.verification) return false
    if (filters.runtime !== 'all' && capability.runtimeState.lifecycle !== filters.runtime) return false
    return !filters.anomaliesOnly || capabilityHasAnomaly(capability, snapshot)
  })
}

/** A deliberately allowlisted, local-path-free diagnostic report. */
export function buildDiagnostics(snapshot: InspectionSnapshot): string {
  const compatibility = snapshot.compatibility
  const publicReviewedIds = new Set(snapshot.capabilities
    .filter((capability) => capability.official && capability.baseline.reviewed && capability.baseline.expectedPackageName === capability.packageName)
    .map((capability) => capability.id))
  const publicCapability = (capability: Capability): boolean => publicReviewedIds.has(capability.id)
  const diagnosticFinding = (finding: CompatibilityFinding): string => {
    // `id` originates in the external Loader. It is only safe to copy where
    // this inspection independently recognizes the exact reviewed built-in.
    const id = finding.id !== undefined && publicReviewedIds.has(finding.id) ? ` (${finding.id})` : finding.id === undefined ? '' : ' (redacted)'
    return `- ${finding.scope}:${finding.code}${id}`
  }
  const lines = [
    'dsh-builtin-toggles capability inspector',
    `schemaVersion: ${snapshot.schemaVersion}`,
    `compatibility: ${compatibility.status}`,
    `runtimeIdentity: ${compatibility.runtimeIdentity.status}`,
    `inventory: total=${snapshot.inventory.totalEntries}, official=${snapshot.inventory.officialEntries}, external=${snapshot.inventory.externalEntries}, reviewed=${snapshot.inventory.reviewedEntries}`,
    'findings:',
    ...compatibility.findings.map(diagnosticFinding),
    'capabilities:',
    ...snapshot.capabilities.map((capability) => [
      `- capability=${publicCapability(capability) ? capability.id : 'external-or-unreviewed'}`,
      `package=${publicCapability(capability) ? capability.packageName : 'redacted'}`,
      // Only the plane is shared; the full scopeId embeds the Loader owner
      // chain, which could carry user-defined or external owner ids.
      `compositionScope=${capability.compositionScope}`,
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

export function deepLinkIndex(capabilities: readonly Capability[], id: string | null): number {
  return id === null ? -1 : capabilities.findIndex((capability) => capability.id === id)
}

/** Controls are presentation only; eligibility itself is always server-computed. */
export function availableActions(capability: Capability, snapshot: Pick<InspectionSnapshot, 'access'>): readonly MutationAction[] {
  if (snapshot.access.mutation !== 'allowed') return []
  // Defense in depth: per-session Agent Preset rows are never mutation
  // targets even if a future DTO projection ever slipped. The server is the
  // authority (policy locked + eligibility ineligible at the DTO level).
  if (capability.compositionScope !== 'host') return []
  if (capability.mutationEligibility.status !== 'eligible' || capability.configuration.profileOverride.state === 'unavailable' || capability.configuration.profileOverride.state === 'not-applicable') return []
  switch (capability.configuration.profileOverride.state) {
    case 'inherited': return ['force-enable', 'force-disable']
    case 'explicitly-enabled': return ['force-disable', 'restore-inheritance']
    case 'explicitly-disabled': return ['force-enable', 'restore-inheritance']
  }
}
