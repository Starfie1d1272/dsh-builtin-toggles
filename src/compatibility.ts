import {
  baselineById,
  type ReviewedCapabilityBaseline,
} from './evidence.ts'
import { OFFICIAL_PACKAGE_PREFIX } from './policy.ts'

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type CompatibilityFindingCode = 'missing_expected_entry' | 'new_official_entry' | 'package_identity_changed' | 'declared_inject_changed' | 'baseline_package_unknown'

export interface RuntimeEntryEvidence {
  id: string
  packageName: string
  declaredInject: readonly string[] | null
}

export interface CompatibilityFinding {
  code: CompatibilityFindingCode
  id: string
  expected?: string | readonly string[] | null
  observed?: string | readonly string[] | null
}

export interface CompatibilityEvaluation {
  status: VerificationStatus
  findings: readonly CompatibilityFinding[]
  verifiedCount: number
  driftedCount: number
  unverifiedCount: number
}

function sameStrings(left: readonly string[] | null, right: readonly string[]): boolean {
  return left !== null && left.length === right.length && left.every((value, index) => value === right[index])
}

/**
 * Compare runtime Loader facts to the reviewed baseline. This evaluator only
 * reports evidence; PR 1 deliberately does not feed its result into POST.
 */
export function evaluateCompatibility(
  runtimeEntries: readonly RuntimeEntryEvidence[],
  baseline: readonly ReviewedCapabilityBaseline[],
): CompatibilityEvaluation {
  const expected = baselineById(baseline)
  const runtimeOfficial = runtimeEntries.filter((entry) => entry.packageName.startsWith(OFFICIAL_PACKAGE_PREFIX))
  const actual = new Map(runtimeOfficial.map((entry) => [entry.id, entry]))
  const findings: CompatibilityFinding[] = []
  let verifiedCount = 0
  let driftedCount = 0
  let unverifiedCount = 0

  for (const reviewed of baseline) {
    const entry = actual.get(reviewed.id)
    if (entry === undefined) {
      findings.push({ code: 'missing_expected_entry', id: reviewed.id, expected: reviewed.expectedPackageName })
      driftedCount += 1
      continue
    }
    if (reviewed.expectedPackageName === null) {
      findings.push({ code: 'baseline_package_unknown', id: reviewed.id, observed: entry.packageName })
      unverifiedCount += 1
      continue
    }
    if (entry.packageName !== reviewed.expectedPackageName) {
      findings.push({ code: 'package_identity_changed', id: reviewed.id, expected: reviewed.expectedPackageName, observed: entry.packageName })
      driftedCount += 1
      continue
    }
    const declaredInject = reviewed.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')
    if (declaredInject !== undefined && !sameStrings(entry.declaredInject, declaredInject.expectedServices)) {
      findings.push({ code: 'declared_inject_changed', id: reviewed.id, expected: declaredInject.expectedServices, observed: entry.declaredInject })
      driftedCount += 1
      continue
    }
    verifiedCount += 1
  }

  for (const entry of runtimeOfficial) {
    if (expected.has(entry.id)) continue
    findings.push({ code: 'new_official_entry', id: entry.id, observed: entry.packageName })
    driftedCount += 1
  }

  return {
    status: driftedCount > 0 ? 'drifted' : unverifiedCount > 0 ? 'unverified' : 'verified',
    findings,
    verifiedCount,
    driftedCount,
    unverifiedCount,
  }
}
