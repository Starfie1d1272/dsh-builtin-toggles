import {
  baselineById,
  REVIEWED_RC6_COMPOSITION_IDENTITY,
  type ReviewedCompositionIdentity,
  type ReviewedCapabilityBaseline,
} from './evidence.ts'
import { OFFICIAL_PACKAGE_PREFIX } from './policy.ts'

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type CompatibilityFindingCode = 'missing_expected_entry' | 'new_official_entry' | 'package_identity_changed' | 'declared_inject_changed' | 'baseline_package_unknown' | 'duplicate_runtime_id' | 'runtime_release_identity_unavailable' | 'runtime_release_identity_mismatch'

export interface RuntimeEntryEvidence {
  id: string
  packageName: string
  /** False means Loader exposed an inject shape this inspector cannot compare. */
  declaredInjectKnown?: boolean
  declaredInject: readonly string[] | null
}

/**
 * DSH rc.6 creates these platform/bootstrap helpers after the reviewed patch
 * composition has loaded. They are not rows in either published patch, so
 * treating their opaque runtime ids as composition additions would make the
 * reviewed Host permanently un-mutable. They remain unlisted and locked; this
 * exception only prevents their exact reviewed packages from fabricating a
 * roster drift finding.
 */
const REVIEWED_RC6_BOOTSTRAP_AUGMENTATION_PACKAGES = new Set([
  '@deepseek-ai/cordis-plugin-hmr',
  '@deepseek-ai/dsh-host-directory-picker-native',
  '@deepseek-ai/dsh-client-ui-directory-picker-native',
])

function isReviewedBootstrapAugmentation(entry: RuntimeEntryEvidence): boolean {
  return REVIEWED_RC6_BOOTSTRAP_AUGMENTATION_PACKAGES.has(entry.packageName)
}

/** Evidence supplied by a stable, Host-owned runtime identity seam. */
export interface RuntimeCompositionIdentity {
  kind: 'dsh-release'
  value: string
  source: 'host-runtime-metadata' | 'immutable-fingerprint'
}

export type RuntimeIdentityStatus = 'matched' | 'mismatched' | 'unavailable'

export interface CompatibilityFinding {
  scope: 'composition' | 'entry'
  code: CompatibilityFindingCode
  id?: string
  expected?: string | readonly string[] | ReviewedCompositionIdentity | null
  observed?: string | readonly string[] | RuntimeCompositionIdentity | null
}

export interface CompatibilityEvaluation {
  status: VerificationStatus
  runtimeIdentity: {
    expected: ReviewedCompositionIdentity
    observed: RuntimeCompositionIdentity | null
    status: RuntimeIdentityStatus
  }
  findings: readonly CompatibilityFinding[]
  verifiedCount: number
  driftedCount: number
  unverifiedCount: number
}

/**
 * Cordis resolves an inject string array by assigning each service name into a
 * record. Array order therefore does not affect the resolved injection set.
 */
function canonicalInject(value: readonly string[] | null): readonly string[] | null {
  return value === null ? null : [...new Set(value)].sort()
}

function sameInject(left: readonly string[] | null, known: boolean, right: readonly string[] | null): boolean {
  if (!known || left === null || right === null) return known && left === right
  const canonicalLeft = canonicalInject(left)
  const canonicalRight = canonicalInject(right)
  return canonicalLeft !== null && canonicalLeft.length === canonicalRight!.length
    && canonicalLeft.every((value, index) => value === canonicalRight![index])
}

/**
 * Compare runtime Loader facts to the reviewed baseline. This evaluator only
 * reports evidence; PR 1 deliberately does not feed its result into POST.
 */
export function evaluateCompatibility(
  runtimeEntries: readonly RuntimeEntryEvidence[],
  baseline: readonly ReviewedCapabilityBaseline[],
  runtimeIdentity: RuntimeCompositionIdentity | null = null,
  expectedIdentity: ReviewedCompositionIdentity = REVIEWED_RC6_COMPOSITION_IDENTITY,
): CompatibilityEvaluation {
  const expected = baselineById(baseline)
  const runtimeById = new Map<string, RuntimeEntryEvidence[]>()
  for (const entry of runtimeEntries) {
    const entries = runtimeById.get(entry.id)
    if (entries === undefined) runtimeById.set(entry.id, [entry])
    else entries.push(entry)
  }
  const findings: CompatibilityFinding[] = []
  const directDriftIds = new Set<string>()
  const structurallyMatchingReviewedIds = new Set<string>()
  const incompleteReviewedIds = new Set<string>()
  const identityStatus: RuntimeIdentityStatus = runtimeIdentity === null
    ? 'unavailable'
    : runtimeIdentity.kind === expectedIdentity.kind && runtimeIdentity.value === expectedIdentity.value
      ? 'matched'
      : 'mismatched'

  if (identityStatus === 'unavailable') {
    findings.push({ scope: 'composition', code: 'runtime_release_identity_unavailable', expected: expectedIdentity, observed: null })
  } else if (identityStatus === 'mismatched') {
    findings.push({ scope: 'composition', code: 'runtime_release_identity_mismatch', expected: expectedIdentity, observed: runtimeIdentity })
  }

  const duplicateIds = new Set<string>()
  for (const [id, entries] of runtimeById) {
    if (entries.length < 2) continue
    duplicateIds.add(id)
    findings.push({ scope: 'entry', code: 'duplicate_runtime_id', id, observed: entries.map((entry) => entry.packageName) })
    directDriftIds.add(id)
  }

  for (const reviewed of baseline) {
    const entries = runtimeById.get(reviewed.id)
    if (entries === undefined) {
      findings.push({ scope: 'entry', code: 'missing_expected_entry', id: reviewed.id, expected: reviewed.expectedPackageName })
      directDriftIds.add(reviewed.id)
      continue
    }
    if (duplicateIds.has(reviewed.id)) continue
    const entry = entries[0]!
    if (reviewed.expectedPackageName === null) {
      findings.push({ scope: 'entry', code: 'baseline_package_unknown', id: reviewed.id, observed: entry.packageName })
      incompleteReviewedIds.add(reviewed.id)
      continue
    }
    if (entry.packageName !== reviewed.expectedPackageName) {
      findings.push({ scope: 'entry', code: 'package_identity_changed', id: reviewed.id, expected: reviewed.expectedPackageName, observed: entry.packageName })
      directDriftIds.add(reviewed.id)
      continue
    }
    const declaredInject = reviewed.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')
    if (declaredInject !== undefined && !sameInject(entry.declaredInject, entry.declaredInjectKnown !== false, declaredInject.expectedServices)) {
      findings.push({ scope: 'entry', code: 'declared_inject_changed', id: reviewed.id, expected: declaredInject.expectedServices, observed: entry.declaredInject })
      directDriftIds.add(reviewed.id)
      continue
    }
    structurallyMatchingReviewedIds.add(reviewed.id)
  }

  for (const [id, entries] of runtimeById) {
    if (duplicateIds.has(id)) continue
    const entry = entries[0]!
    if (!entry.packageName.startsWith(OFFICIAL_PACKAGE_PREFIX)) continue
    if (isReviewedBootstrapAugmentation(entry)) continue
    if (expected.has(entry.id)) continue
    findings.push({ scope: 'entry', code: 'new_official_entry', id: entry.id, observed: entry.packageName })
    directDriftIds.add(entry.id)
  }

  const identityBound = identityStatus === 'matched'
  const unverifiedCount = incompleteReviewedIds.size
    + (identityBound ? 0 : structurallyMatchingReviewedIds.size)

  return {
    // A direct structural difference and a trustworthy identity mismatch are
    // both drift. Missing proof alone remains unverified.
    status: identityStatus === 'mismatched' || directDriftIds.size > 0
      ? 'drifted'
      : unverifiedCount > 0
        ? 'unverified'
        : 'verified',
    runtimeIdentity: { expected: expectedIdentity, observed: runtimeIdentity, status: identityStatus },
    findings,
    // These are entry assertion counts only: a composition identity finding
    // never contributes a synthetic extra row. Missing expected ids and new
    // official ids each count once by id; duplicate runtime ids likewise.
    verifiedCount: identityBound ? structurallyMatchingReviewedIds.size : 0,
    driftedCount: directDriftIds.size,
    unverifiedCount,
  }
}
