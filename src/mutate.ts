/**
 * Mutation orchestration for POST /api/builtin-toggles/<id>.
 *
 * Pure of HTTP plumbing and of the real loader/filesystem — both are
 * injected — so the whole decision tree (checks, runtime update, persistence,
 * rollback, concurrency refusal) is unit-testable. The route handler in
 * index.ts is only a thin adapter on top of this.
 *
 * Order of operations:
 *   1. policy + per-entry eligibility gate (allowlist → body schema → entry
 *      → official module → reviewed structural evidence); any refusal is a
 *      4xx with zero mutation;
 *   2. conservative profile-writer preflight; known persistence refusals are
 *      returned before the Loader is touched;
 *   3. force-enable/disable update the Loader, then persist the same override;
 *      restore persists first and lets DSH's profile/HMR recomposition expose
 *      the lower layer (Loader `disabled: null` alone cannot do that);
 *   4. on any persistence failure, roll the runtime back to its previous own
 *      `disabled` value and report the error — no half-applied state.
 */

import {
  checkMutation,
  parseMutationBody,
  type EntryFacts,
  type MutationAction,
} from './policy.ts'
import { evaluateMutationEligibility } from './eligibility.ts'
import {
  ConcurrentEditError,
  PatchError,
  preflightProfileMutation,
  type ProfileMutationPreflight,
} from './profile-patch.ts'
import type { RuntimeEntryEvidence } from './compatibility.ts'
import type { ReviewedCapabilityBaseline } from './evidence.ts'

/** One loader entry handle the orchestrator can read and mutate. */
export interface EntryHandle {
  /** Facts for the policy gate and the snapshot. */
  facts: EntryFacts
  /** The entry's OWN `disabled` field before mutation (undefined = unset). */
  ownDisabled: boolean | null | undefined
  /** Public Loader config evidence; false means the inject shape is opaque. */
  declaredInject: readonly string[] | null
  declaredInjectKnown: boolean
  /** Apply a runtime update; rejects on failure. */
  update: (options: { disabled: boolean | null }) => Promise<void>
}

/** Filesystem/loader seam for tests. */
export interface MutateDeps {
  /** Profile patch file path. */
  patchFile: string
  /** One coherent public Loader inventory for policy, eligibility and mutation. */
  listEntries: () => readonly EntryHandle[]
  /** Test seam only; production always uses the frozen full baseline. */
  eligibilityBaseline?: readonly ReviewedCapabilityBaseline[]
  /** Read-only writer preflight. The locked writer repeats this at commit time. */
  profilePreflight?: (file: string, id: string) => ProfileMutationPreflight
  /**
   * Persist the override; returns whether the file changed.
   * Rejects with ConcurrentEditError / PatchError / fs errors.
   */
  persist: (file: string, id: string, action: MutationAction) => Promise<{ changed: boolean }>
}

/** Wire deps used by the real route handler. */
export interface MutateOk {
  status: 200
  body: {
    ok: true
    id: string
    action: MutationAction
    disabled: boolean | null
    /** Explicit overrides are immediate; inheritance waits for DSH HMR composition. */
    runtimeEffect: 'applied' | 'recomposing'
    persisted: boolean
  }
}

export interface MutateError {
  status: number
  body: {
    ok: false
    error: string
    message: string
  }
}

export type MutateResult = MutateOk | MutateError

function refuse(status: number, error: string, message: string): MutateError {
  return { status, body: { ok: false, error, message } }
}

/**
 * Run one toggle. `rawBody` is the JSON-parsed request body (any shape).
 * Never mutates on any refusal path.
 */
export async function runToggle(
  deps: MutateDeps,
  id: string,
  rawBody: unknown,
): Promise<MutateResult> {
  const body = parseMutationBody(rawBody)
  const entries = deps.listEntries()
  const entry = entries.find((candidate) => candidate.facts.id === id)
  const verdict = checkMutation(id, entry?.facts, body)

  if (!verdict.ok) {
    return refuse(verdict.status, verdict.code, verdict.message)
  }

  const action: MutationAction = 'disabled' in body!
    ? body!.disabled ? 'force-disable' : 'force-enable'
    : body!.action
  const runtimeEvidence: RuntimeEntryEvidence[] = entries.map((candidate) => ({
    id: candidate.facts.id,
    packageName: candidate.facts.name,
    declaredInject: candidate.declaredInject,
    declaredInjectKnown: candidate.declaredInjectKnown,
  }))
  const profileMutation = deps.profilePreflight?.(deps.patchFile, id) ?? preflightProfileMutation(deps.patchFile, id)
  const eligibility = evaluateMutationEligibility(id, runtimeEvidence, deps.eligibilityBaseline, undefined, profileMutation)
  if (eligibility.status !== 'eligible') {
    return refuse(409, 'mutation_ineligible', `builtin-toggles: ${id} is not eligible (${eligibility.reasons.join(', ')})`)
  }

  const disabled = action === 'force-disable' ? true : action === 'force-enable' ? false : null
  const previousOwn = entry!.ownDisabled

  // The public Loader's null update deletes only its current option. DSH's
  // profile watcher is the supported mechanism that re-composes all layers,
  // so restore must write the profile patch and leave recomposition to HMR.
  if (action === 'restore-inheritance') {
    try {
      const persisted = (await deps.persist(deps.patchFile, id, action)).changed
      return {
        status: 200,
        body: { ok: true, id, action, disabled, runtimeEffect: 'recomposing', persisted },
      }
    } catch (error) {
      return persistFailure(error)
    }
  }

  // Runtime first for explicit values: the Loader is the authority for the
  // current session and persistence failure is rolled back below.
  try {
    await entry!.update({ disabled })
  } catch (error) {
    return refuse(500, 'runtime_update_failed', errorMessage(error, `loader entry update failed for ${id}`))
  }

  // Persistence second: survives restart; on failure roll the runtime back.
  let persisted = false
  try {
    persisted = (await deps.persist(deps.patchFile, id, action)).changed
  } catch (error) {
    const rollbackError = await rollbackRuntime(entry!, previousOwn)
    if (rollbackError !== undefined) {
      return refuse(500, 'persist_failed', `persist failed (${errorMessage(error, 'write error')}) and runtime rollback also failed (${rollbackError}); profile may be inconsistent`)
    }
    return persistFailure(error)
  }

  return {
    status: 200,
    body: { ok: true, id, action, disabled, runtimeEffect: 'applied', persisted },
  }
}

function persistFailure(error: unknown): MutateError {
  if (error instanceof ConcurrentEditError) return refuse(409, 'concurrent_edit', error.message)
  if (error instanceof PatchError) return refuse(500, 'patch_refused', error.message)
  return refuse(500, 'persist_failed', errorMessage(error, 'failed to write profile patch'))
}

/** Restore the entry's own disabled field; returns an error message on failure. */
async function rollbackRuntime(entry: EntryHandle, previousOwn: boolean | null | undefined): Promise<string | undefined> {
  try {
    await entry.update({ disabled: previousOwn === undefined ? null : previousOwn })
    return undefined
  } catch (error) {
    return errorMessage(error, 'rollback failed')
  }
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message.length > 0 ? error.message : fallback
}
