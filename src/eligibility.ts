/**
 * Per-entry mutation eligibility.
 *
 * Inspection compatibility answers whether this complete runtime can be bound
 * to a reviewed release. Mutation eligibility is narrower: it only permits a
 * reviewed UI leaf after its own structural evidence and every observable
 * dependency assumption remain intact. A missing Host release identity is an
 * explicitly reported limitation, not a fabricated verification result and
 * not, by itself, an automatic denial.
 */

import { evaluateCompatibility, type CompatibilityEvaluation, type RuntimeEntryEvidence } from './compatibility.ts'
import { baselineById, REVIEWED_DSH_WEB_BASELINE, type ReviewedCapabilityBaseline } from './evidence.ts'
import { MANAGEABLE } from './policy.ts'
import type { ProfileMutationPreflight } from './profile-patch.ts'

export type EligibilityReason =
  | 'not_manageable'
  | 'missing_runtime_entry'
  | 'reviewed_baseline_missing'
  | 'reviewed_safe_leaf_evidence_missing'
  | 'target_structural_drift'
  | 'global_structural_drift'
  | 'runtime_identity_mismatch'
  | 'profile_not_persistable'

export type EligibilityLimitation = 'runtime_identity_unavailable' | 'consumer_graph_not_exposed'

export interface MutationEligibility {
  status: 'eligible' | 'ineligible'
  reasons: readonly EligibilityReason[]
  /** Non-authorizing facts retained so callers never mistake eligibility for release verification. */
  limitations: readonly EligibilityLimitation[]
}

function hasCompleteSafeLeafEvidence(entry: ReviewedCapabilityBaseline | undefined): boolean {
  return entry !== undefined
    && entry.expectedPackageName !== null
    && entry.leafReview === 'reviewed-safe-ui-leaf'
    && entry.reviewedReference !== null
    && entry.dependencyEvidence.provides.status === 'observed'
    && entry.dependencyEvidence.consumers.status === 'observed'
}

function addReason(reasons: EligibilityReason[], reason: EligibilityReason): void {
  if (!reasons.includes(reason)) reasons.push(reason)
}

/**
 * Decide one requested mutation from runtime facts available through public
 * Loader APIs. It intentionally does not use `compatibility.status`: a Host
 * may not expose release identity, while target-local evidence can still be
 * exact. Conversely, a discovered composition change is denied when the
 * public seam cannot show that it is not a new consumer of a reviewed leaf.
 */
export function evaluateMutationEligibility(
  id: string,
  runtimeEntries: readonly RuntimeEntryEvidence[],
  baseline: readonly ReviewedCapabilityBaseline[] = REVIEWED_DSH_WEB_BASELINE,
  compatibility: CompatibilityEvaluation = evaluateCompatibility(runtimeEntries, baseline),
  profileMutation: ProfileMutationPreflight = { status: 'writable' },
): MutationEligibility {
  const reasons: EligibilityReason[] = []
  const limitations: EligibilityLimitation[] = ['consumer_graph_not_exposed']
  const reviewed = baselineById(baseline).get(id)
  const targetEntries = runtimeEntries.filter((entry) => entry.id === id)

  if (!MANAGEABLE.has(id)) addReason(reasons, 'not_manageable')
  if (targetEntries.length === 0) addReason(reasons, 'missing_runtime_entry')
  if (reviewed === undefined) addReason(reasons, 'reviewed_baseline_missing')
  if (!hasCompleteSafeLeafEvidence(reviewed)) addReason(reasons, 'reviewed_safe_leaf_evidence_missing')
  if (profileMutation.status !== 'writable') addReason(reasons, 'profile_not_persistable')

  if (compatibility.runtimeIdentity.status === 'unavailable') {
    limitations.push('runtime_identity_unavailable')
  } else if (compatibility.runtimeIdentity.status === 'mismatched') {
    addReason(reasons, 'runtime_identity_mismatch')
  }

  for (const finding of compatibility.findings) {
    if (finding.scope === 'composition') continue
    if (finding.id === id) {
      addReason(reasons, 'target_structural_drift')
      continue
    }
    // Loader exposes entry ids, package names and some inject declarations,
    // but no provider/consumer graph. Any observed change to another reviewed
    // row, or a new official row, could otherwise introduce a new consumer of
    // a leaf's reviewed-empty service surface. Do not silently ignore it.
    addReason(reasons, 'global_structural_drift')
  }

  return {
    status: reasons.length === 0 ? 'eligible' : 'ineligible',
    reasons,
    limitations,
  }
}
