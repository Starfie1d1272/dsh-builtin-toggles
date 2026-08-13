/**
 * Mutation orchestration for POST /api/builtin-toggles/<id>.
 *
 * Pure of HTTP plumbing and of the real loader/filesystem — both are
 * injected — so the whole decision tree (checks, runtime update, persistence,
 * rollback, concurrency refusal) is unit-testable. The route handler in
 * index.ts is only a thin adapter on top of this.
 *
 * Order of operations:
 *   1. policy gate (allowlist → body schema → entry exists → official module
 *      → not self); any refusal is a 4xx with zero mutation;
 *   2. runtime update via `entry.update({ disabled })` (current session);
 *   3. persist the same override into the profile patch (survives restart);
 *   4. on any persistence failure, roll the runtime back to its previous own
 *      `disabled` value and report the error — no half-applied state.
 */

import {
  checkMutation,
  parseDisabledBody,
  type EntryFacts,
} from './policy.ts'
import {
  applyDisabledOverride,
  ConcurrentEditError,
  PatchError,
} from './profile-patch.ts'

/** One loader entry handle the orchestrator can read and mutate. */
export interface EntryHandle {
  /** Facts for the policy gate and the snapshot. */
  facts: EntryFacts
  /** The entry's OWN `disabled` field before mutation (undefined = unset). */
  ownDisabled: boolean | null | undefined
  /** Apply a runtime update; rejects on failure. */
  update: (options: { disabled: boolean | null }) => Promise<void>
}

/** Filesystem/loader seam for tests. */
export interface MutateDeps {
  /** Profile patch file path. */
  patchFile: string
  /** Look up one loader entry by its short id; undefined when absent. */
  findEntry: (id: string) => EntryHandle | undefined
  /**
   * Persist the override; returns whether the file changed.
   * Throws ConcurrentEditError / PatchError / fs errors.
   */
  persist: (file: string, id: string, disabled: boolean) => { changed: boolean }
}

/** Wire deps used by the real route handler. */
export function realPersist(): MutateDeps['persist'] {
  return (file, id, disabled) => {
    const result = applyDisabledOverride(file, id, disabled)
    return { changed: result.changed }
  }
}

export interface MutateOk {
  status: 200
  body: {
    ok: true
    id: string
    disabled: boolean
    runtime: true
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
  const body = parseDisabledBody(rawBody)
  const entry = deps.findEntry(id)
  const verdict = checkMutation(id, entry?.facts, body)

  if (!verdict.ok) {
    return refuse(verdict.status, verdict.code, verdict.message)
  }

  const disabled = body!.disabled
  const previousOwn = entry!.ownDisabled

  // Runtime first: the Loader is the authority for the current session.
  try {
    await entry!.update({ disabled })
  } catch (error) {
    return refuse(500, 'runtime_update_failed', errorMessage(error, `loader entry update failed for ${id}`))
  }

  // Persistence second: survives restart; on failure roll the runtime back.
  let persisted = false
  try {
    persisted = deps.persist(deps.patchFile, id, disabled).changed
  } catch (error) {
    const rollbackError = await rollbackRuntime(entry!, previousOwn)
    if (rollbackError !== undefined) {
      return refuse(500, 'persist_failed', `persist failed (${errorMessage(error, 'write error')}) and runtime rollback also failed (${rollbackError}); profile may be inconsistent`)
    }
    if (error instanceof ConcurrentEditError) {
      return refuse(409, 'concurrent_edit', error.message)
    }
    if (error instanceof PatchError) {
      return refuse(500, 'patch_refused', error.message)
    }
    return refuse(500, 'persist_failed', errorMessage(error, 'failed to write profile patch'))
  }

  return {
    status: 200,
    body: { ok: true, id, disabled, runtime: true, persisted },
  }
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
