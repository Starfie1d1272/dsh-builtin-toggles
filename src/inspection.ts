import {
  evaluateCompatibility,
  type CompatibilityEvaluation,
  type RuntimeCompositionIdentity,
  type RuntimeEntryEvidence,
  type VerificationStatus,
} from './compatibility.ts'
import {
  baselineById,
  REVIEWED_DSH_WEB_BASELINE,
  type CapabilityCategory,
  type DependencyEvidence,
  type ManagementPlane,
  type ReviewedReference,
  type ServiceEvidence,
  type LeafReview,
} from './evidence.ts'
import { classifyEntry, OFFICIAL_PACKAGE_PREFIX, type EntryFacts, type LockReason } from './policy.ts'
import { evaluateMutationEligibility, type MutationEligibility } from './eligibility.ts'
import type { CompositionScope } from './loader-scope.ts'
import type { ProfileInspectionSnapshot, ProfileMutationPreflight, ProfileOverrideInspection } from './profile-patch.ts'

export const INSPECTION_SCHEMA_VERSION = 'builtin-toggles.inspection/v1'
export type RuntimeLifecycle = 'inactive' | 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'unknown'

export interface InspectionRuntimeEntry extends EntryFacts {
  declaredInject: readonly string[] | null
  declaredInjectKnown: boolean
  /** Effective Loader entry option, not a claim about which patch layer supplied it. */
  ownDisabled: boolean | undefined
  /** Loader-computed identity qualified by the owning-tree entry chain. */
  scopeId: string
  /** Public composition plane attribution (Host vs per-session Agent Preset). */
  compositionScope: CompositionScope
}

export interface InspectedCapability {
  id: string
  packageName: string
  official: boolean
  /** Loader-computed identity qualified by the owning-tree entry chain. */
  scopeId: string
  /** Public composition plane; per-session preset rows are never host-manageable. */
  compositionScope: CompositionScope
  runtimeState: { disabled: boolean; lifecycle: RuntimeLifecycle }
  configuration: {
    /** Profile-layer state; this is separate from Loader lifecycle and effective disabled. */
    profileOverride: ProfileOverrideInspection
    /** Whether the server can conservatively persist a mutation to this profile row. */
    profilePersistence: ProfileMutationPreflight
    /** The Loader's current effective result, which can differ while a mutation is in flight. */
    effectiveDisabled: boolean
    /** Agent Preset ownership is shown separately and is never a profile override. */
    agentPresetManaged: boolean
  }
  managementPlane: ManagementPlane
  category: CapabilityCategory
  policy: { status: 'manageable' | 'locked'; reason?: LockReason }
  verification: VerificationStatus
  mutationEligibility: MutationEligibility
  baseline: {
    reviewed: boolean
    expectedPackageName: string | null
    reviewedReference: ReviewedReference | null
    serviceEvidence: readonly ServiceEvidence[]
    dependencyEvidence: DependencyEvidence | null
    leafReview: LeafReview | null
    rationale: string | null
  }
}

export interface InspectionResponseV1 {
  schemaVersion: typeof INSPECTION_SCHEMA_VERSION
  host: { plugin: 'builtin-toggles'; profile: 'web' }
  /** Request-scoped transport access; distinct from per-capability eligibility. */
  access: { mutation: 'allowed' | 'loopback-required' }
  compatibility: CompatibilityEvaluation
  inventory: { totalEntries: number; officialEntries: number; externalEntries: number; reviewedEntries: number }
  capabilities: readonly InspectedCapability[]
}

function unknownPlane(): ManagementPlane { return 'unknown' }
function unknownCategory(): CapabilityCategory { return 'unknown' }

function lifecycleFor(phase: string | null): RuntimeLifecycle {
  if (phase === null) return 'inactive'
  if (phase === 'pending' || phase === 'loading' || phase === 'active' || phase === 'failed' || phase === 'unloading') return phase
  return 'unknown'
}

/** Build the versioned, presentation-free inspection DTO. */
export function buildInspectionResponse(
  entries: readonly InspectionRuntimeEntry[],
  runtimeIdentity: RuntimeCompositionIdentity | null,
  profile: ProfileInspectionSnapshot,
  mutationAccess: 'allowed' | 'loopback-required',
): InspectionResponseV1 {
  const baseline = baselineById()
  const runtimeEvidence: RuntimeEntryEvidence[] = entries.map((entry) => ({
    id: entry.id,
    packageName: entry.name,
    declaredInject: entry.declaredInject,
    declaredInjectKnown: entry.declaredInjectKnown,
    scopeId: entry.scopeId,
    compositionScope: entry.compositionScope,
  }))
  const compatibility = evaluateCompatibility(runtimeEvidence, REVIEWED_DSH_WEB_BASELINE, runtimeIdentity)
  const findingCodesById = new Map<string, VerificationStatus>()
  for (const finding of compatibility.findings) {
    if (finding.scope !== 'entry' || finding.id === undefined) continue
    findingCodesById.set(finding.id, finding.code === 'baseline_package_unknown' || finding.code === 'new_official_entry' ? 'unverified' : 'drifted')
  }
  const identityVerified = compatibility.runtimeIdentity.status === 'matched'
  const capabilities = entries.map((entry): InspectedCapability => {
    const reviewed = baseline.get(entry.id)
    // Per-session Agent Preset rows are augmentations of a running session,
    // never part of the reviewed Host composition: they cannot verify it, no
    // Host release finding applies to them, and they must never inherit the
    // Host row's policy, profile state, or mutation eligibility. A preset row
    // sharing a bare id with an allowlisted Host row stays locked and
    // ineligible server-side; the UI hiding is never the boundary.
    const presetRow = entry.compositionScope === 'agent-preset'
    const policy = classifyEntry(entry)
    // A caller that failed to provide profile provenance must never turn an
    // inspection row writable or infer a patch override from effective state.
    const override = profile.profileOverrides.get(entry.id) ?? { state: 'unavailable' as const, reason: 'profile_unavailable' as const }
    const writable = profile.profilePersistence.get(entry.id) ?? { status: 'unwritable' as const, reason: 'profile_patch_unreadable' as const }
    return {
      id: entry.id,
      packageName: entry.name,
      official: entry.name.startsWith(OFFICIAL_PACKAGE_PREFIX),
      scopeId: entry.scopeId,
      compositionScope: entry.compositionScope,
      runtimeState: { disabled: entry.disabled, lifecycle: lifecycleFor(entry.phase) },
      configuration: {
        profileOverride: presetRow ? { state: 'not-applicable' as const } : override,
        profilePersistence: presetRow ? { status: 'not-applicable' as const } : writable,
        effectiveDisabled: entry.disabled,
        agentPresetManaged: reviewed?.managementPlane === 'agent-preset',
      },
      managementPlane: reviewed?.managementPlane ?? unknownPlane(),
      category: reviewed?.category ?? unknownCategory(),
      policy: presetRow
        ? { status: 'locked', reason: 'agent-preset' as const }
        : policy.manageable ? { status: 'manageable' } : { status: 'locked', reason: policy.reason },
      verification: presetRow ? 'unverified' : findingCodesById.get(entry.id) ?? (
        reviewed === undefined ? 'unverified' : !identityVerified ? 'unverified' : 'verified'
      ),
      mutationEligibility: presetRow
        ? { status: 'ineligible' as const, reasons: ['agent_preset_scope' as const], limitations: ['consumer_graph_not_exposed' as const] }
        : evaluateMutationEligibility(entry.id, runtimeEvidence, REVIEWED_DSH_WEB_BASELINE, compatibility, writable),
      baseline: {
        reviewed: reviewed !== undefined,
        expectedPackageName: reviewed?.expectedPackageName ?? null,
        reviewedReference: reviewed?.reviewedReference ?? null,
        serviceEvidence: reviewed?.serviceEvidence ?? [],
        dependencyEvidence: reviewed?.dependencyEvidence ?? null,
        leafReview: reviewed?.leafReview ?? null,
        rationale: reviewed?.rationale ?? null,
      },
    }
  })
  const officialEntries = capabilities.filter((entry) => entry.official).length
  return {
    schemaVersion: INSPECTION_SCHEMA_VERSION,
    host: { plugin: 'builtin-toggles', profile: 'web' },
    access: { mutation: mutationAccess },
    compatibility,
    inventory: {
      totalEntries: capabilities.length,
      officialEntries,
      externalEntries: capabilities.length - officialEntries,
      reviewedEntries: capabilities.filter((entry) => entry.baseline.reviewed).length,
    },
    capabilities,
  }
}
