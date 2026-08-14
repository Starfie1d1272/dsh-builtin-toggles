import {
  baselineById,
  type ReviewedCapabilityBaseline,
} from './evidence.ts'
import { OFFICIAL_PACKAGE_PREFIX } from './policy.ts'

export type VerificationStatus = 'verified' | 'drifted' | 'unverified'
export type CompatibilityFindingCode = 'missing_expected_entry' | 'new_official_entry' | 'package_identity_changed' | 'declared_inject_changed' | 'baseline_package_unknown' | 'duplicate_runtime_id'

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

/**
 * Cordis resolves an inject string array by assigning each service name into a
 * record. Array order therefore does not affect the resolved injection set.
 */
function canonicalInject(value: readonly string[] | null): readonly string[] | null {
  return value === null ? null : [...new Set(value)].sort()
}

function sameInject(left: readonly string[] | null, right: readonly string[]): boolean {
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
): CompatibilityEvaluation {
  const expected = baselineById(baseline)
  const runtimeById = new Map<string, RuntimeEntryEvidence[]>()
  for (const entry of runtimeEntries) {
    const entries = runtimeById.get(entry.id)
    if (entries === undefined) runtimeById.set(entry.id, [entry])
    else entries.push(entry)
  }
  const findings: CompatibilityFinding[] = []
  let verifiedCount = 0
  let driftedCount = 0
  let unverifiedCount = 0

  const duplicateIds = new Set<string>()
  for (const [id, entries] of runtimeById) {
    if (entries.length < 2) continue
    duplicateIds.add(id)
    findings.push({ code: 'duplicate_runtime_id', id, observed: entries.map((entry) => entry.packageName) })
    driftedCount += 1
  }

  for (const reviewed of baseline) {
    const entries = runtimeById.get(reviewed.id)
    if (entries === undefined) {
      findings.push({ code: 'missing_expected_entry', id: reviewed.id, expected: reviewed.expectedPackageName })
      driftedCount += 1
      continue
    }
    if (duplicateIds.has(reviewed.id)) continue
    const entry = entries[0]!
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
    if (declaredInject !== undefined && !sameInject(entry.declaredInject, declaredInject.expectedServices)) {
      findings.push({ code: 'declared_inject_changed', id: reviewed.id, expected: declaredInject.expectedServices, observed: entry.declaredInject })
      driftedCount += 1
      continue
    }
    verifiedCount += 1
  }

  for (const [id, entries] of runtimeById) {
    if (duplicateIds.has(id)) continue
    const entry = entries[0]!
    if (!entry.packageName.startsWith(OFFICIAL_PACKAGE_PREFIX)) continue
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
