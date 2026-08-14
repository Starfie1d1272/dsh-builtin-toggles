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

export const INSPECTION_SCHEMA_VERSION = 'builtin-toggles.inspection/v1'
export type RuntimeLifecycle = 'inactive' | 'pending' | 'loading' | 'active' | 'failed' | 'unloading' | 'unknown'

export interface InspectionRuntimeEntry extends EntryFacts {
  declaredInject: readonly string[] | null
}

export interface InspectedCapability {
  id: string
  packageName: string
  official: boolean
  runtimeState: { disabled: boolean; lifecycle: RuntimeLifecycle }
  managementPlane: ManagementPlane
  category: CapabilityCategory
  policy: { status: 'manageable' | 'locked'; reason?: LockReason }
  verification: VerificationStatus
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
  runtimeIdentity: RuntimeCompositionIdentity | null = null,
): InspectionResponseV1 {
  const baseline = baselineById()
  const runtimeEvidence: RuntimeEntryEvidence[] = entries.map((entry) => ({
    id: entry.id,
    packageName: entry.name,
    declaredInject: entry.declaredInject,
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
    const policy = classifyEntry(entry)
    return {
      id: entry.id,
      packageName: entry.name,
      official: entry.name.startsWith(OFFICIAL_PACKAGE_PREFIX),
      runtimeState: { disabled: entry.disabled, lifecycle: lifecycleFor(entry.phase) },
      managementPlane: reviewed?.managementPlane ?? unknownPlane(),
      category: reviewed?.category ?? unknownCategory(),
      policy: policy.manageable ? { status: 'manageable' } : { status: 'locked', reason: policy.reason },
      verification: findingCodesById.get(entry.id) ?? (reviewed === undefined || !identityVerified ? 'unverified' : 'verified'),
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
