import {
  baselineById,
  REVIEWED_RC6_COMPOSITION_IDENTITY,
  type ReviewedCompositionIdentity,
  type ReviewedCapabilityBaseline,
} from './evidence.ts'
import { OFFICIAL_PACKAGE_PREFIX } from './policy.ts'

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type CompatibilityFindingCode = 'missing_expected_entry' | 'new_official_entry' | 'package_identity_changed' | 'declared_inject_changed' | 'baseline_package_unknown' | 'duplicate_runtime_id' | 'runtime_augmentation_shape_changed' | 'runtime_augmentation_id_conflicts_baseline' | 'runtime_release_identity_unavailable' | 'runtime_release_identity_mismatch'

export interface RuntimeEntryEvidence {
  id: string
  packageName: string
  /** False means Loader exposed an inject shape this inspector cannot compare. */
  declaredInjectKnown?: boolean
  declaredInject: readonly string[] | null
}

/**
 * DSH rc.6 creates these platform/bootstrap helpers after the reviewed patch
 * composition has loaded. Loader generates their ids, so those ids are not
 * release evidence. The reviewed evidence is instead the strict runtime shape:
 * one host/client directory-picker pair using the same platform variant and
 * one HMR helper. They are not published patch-baseline rows and remain locked.
 */
type RuntimeAugmentationRole = 'host-directory-picker' | 'client-directory-picker' | 'hmr'
type DirectoryPickerVariant = 'browse' | 'native'

interface ReviewedRuntimeAugmentation {
  role: RuntimeAugmentationRole
  variant?: DirectoryPickerVariant
}

function reviewedRuntimeAugmentation(entry: RuntimeEntryEvidence): ReviewedRuntimeAugmentation | undefined {
  switch (entry.packageName) {
    case '@deepseek-ai/dsh-host-directory-picker-browse':
      return { role: 'host-directory-picker', variant: 'browse' }
    case '@deepseek-ai/dsh-host-directory-picker-native':
      return { role: 'host-directory-picker', variant: 'native' }
    case '@deepseek-ai/dsh-client-ui-directory-picker-browse':
      return { role: 'client-directory-picker', variant: 'browse' }
    case '@deepseek-ai/dsh-client-ui-directory-picker-native':
      return { role: 'client-directory-picker', variant: 'native' }
    case '@deepseek-ai/cordis-plugin-hmr':
      return { role: 'hmr' }
  }
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

  const runtimeAugmentations: Array<{ entry: RuntimeEntryEvidence; evidence: ReviewedRuntimeAugmentation }> = []
  let observedRuntimeAugmentation = false
  for (const [id, entries] of runtimeById) {
    for (const entry of entries) {
      const augmentation = reviewedRuntimeAugmentation(entry)
      if (augmentation === undefined) continue
      const reviewed = expected.get(entry.id)
      if (reviewed === undefined || reviewed.expectedPackageName !== entry.packageName) observedRuntimeAugmentation = true
      if (reviewed !== undefined && reviewed.expectedPackageName !== entry.packageName) {
        findings.push({
          scope: 'entry', code: 'runtime_augmentation_id_conflicts_baseline', id: entry.id,
          expected: reviewed.expectedPackageName, observed: entry.packageName,
        })
        directDriftIds.add(entry.id)
      }
    }
    if (duplicateIds.has(id)) continue
    const entry = entries[0]!
    if (!entry.packageName.startsWith(OFFICIAL_PACKAGE_PREFIX)) continue
    if (expected.has(entry.id)) continue
    const augmentation = reviewedRuntimeAugmentation(entry)
    if (augmentation !== undefined) {
      runtimeAugmentations.push({ entry, evidence: augmentation })
      continue
    }
    findings.push({ scope: 'entry', code: 'new_official_entry', id: entry.id, observed: entry.packageName })
    directDriftIds.add(entry.id)
  }

  if (observedRuntimeAugmentation) {
    const reportAugmentationShape = (id: string, expectedShape: string, observedShape: string | readonly string[] | null): void => {
      findings.push({ scope: 'entry', code: 'runtime_augmentation_shape_changed', id, expected: expectedShape, observed: observedShape })
      directDriftIds.add(id)
    }
    const host = runtimeAugmentations.filter(({ evidence }) => evidence.role === 'host-directory-picker')
    const client = runtimeAugmentations.filter(({ evidence }) => evidence.role === 'client-directory-picker')
    const hmr = runtimeAugmentations.filter(({ evidence }) => evidence.role === 'hmr')
    for (const [role, entries] of [
      ['host-directory-picker', host],
      ['client-directory-picker', client],
      ['hmr', hmr],
    ] as const) {
      if (entries.length !== 1) {
        reportAugmentationShape(`rc6-runtime-augmentation-${role}`, `exactly one ${role} helper`, entries.map(({ entry }) => entry.packageName))
      }
    }
    if (host.length === 1 && client.length === 1 && host[0]!.evidence.variant !== client[0]!.evidence.variant) {
      reportAugmentationShape(
        'rc6-runtime-augmentation-directory-picker-variant',
        'matching host/client directory-picker variants',
        [host[0]!.entry.packageName, client[0]!.entry.packageName],
      )
    }
    for (const { entry } of runtimeAugmentations) {
      // rc.6 consistently exposes no row-level inject for these generated
      // helpers. Compare that fact only when Loader made it observable.
      if (entry.declaredInjectKnown !== false && entry.declaredInject !== null) {
        reportAugmentationShape(`rc6-runtime-augmentation-inject-${entry.id}`, 'no declared inject', entry.declaredInject)
      }
    }
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
