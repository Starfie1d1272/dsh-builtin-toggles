/**
 * dsh-builtin-toggles security policy.
 *
 * The single source of truth for what may be toggled. Everything not in the
 * exact explicit allowlist is locked — there is no "looks like UI" heuristic.
 * The server re-checks every rule on every POST; the client hiding a switch
 * is never a security boundary.
 */

/**
 * The only plugin ids this manager may ever toggle.
 *
 * Every entry was admitted against the current official web roster
 * (`@deepseek-ai/dsh-web-app` cordis.patch.yml) and its client bundles
 * (npm 0.1.0-rc.6): it exists, is an `@deepseek-ai/*` browser (dsh.client)
 * row, is a pure Web UI / presentation contribution, and disabling it breaks
 * neither the Settings shell, connection, API gateway, conversation core,
 * nor any required downstream. Admission checks each candidate's PROVIDED
 * services and their consumers in the installed bundles.
 *
 * Narrowed 2026-08: `ui-commands` was REMOVED — its client half provides the
 * `commandUi` service, consumed by `ui-conversation` (locked core),
 * `ui-model-selection` and `ui-permission-presets`; toggling it off would
 * strand those mounts, so it is not a safe leaf. Only further narrowing is
 * allowed; never expansion.
 *
 * The agent preset plane, core infrastructure, and everything unknown stay
 * locked by default; see LOCKED_IDS / classify().
 */
export const MANAGEABLE_IDS: readonly string[] = [
  'ui-deliverables',
  'ui-jobs',
  'ui-goal',
  'ui-message-feedback',
  'ui-model-selection',
  'ui-agent-preset',
  'ui-skill',
  'ui-subagent',
  'ui-trajectory',
]

/** O(1) membership. */
export const MANAGEABLE: ReadonlySet<string> = new Set(MANAGEABLE_IDS)

/**
 * Explicitly locked core / infrastructure ids, listed for an accurate
 * "core" reason in the UI. This list never grants anything: manageability
 * comes from MANAGEABLE_IDS alone, and any id absent from both lists is
 * still locked (reason "unlisted"). Unknown ids default to locked.
 */
export const LOCKED_IDS: ReadonlySet<string> = new Set([
  // Loader / Cordis core
  'loader',
  'include',
  'group',
  'timer',
  'hmr',
  // Transport & runtime
  'modules',
  'connection',
  'api-remotes',
  'client-runtime',
  'cordis-client-runner',
  'client-hmr',
  'api-gateway',
  'webserver',
  'web-runtime',
  'web-startup',
  // Shell / chrome / theme / locale
  'ui-theme',
  'locale',
  'ui-layout',
  'ui-sidebar',
  'ui-settings',
  'ui-settings-general',
  'ui-settings-models',
  'ui-settings-plugins',
  'ui-settings-plugin-inventory',
  // Conversation core
  'ui-conversation',
  'ui-input-trigger',
  'ui-tool',
  // Read-only inventory / host infrastructure
  'plugin-inventory',
  'storage',
  'storage-json',
  'storage-domain',
  'session',
  'session-projection-cache',
  'session-query-sqlite',
  'session-stats',
  'session-log-download',
  'workspace',
  'code-runtime',
  'message-feedback',
  'directory-picker',
])

/**
 * Ids this plugin itself owns. A plugin must never toggle itself off: that
 * would unload the manager's API while its persistence has already run.
 * (The package is not `@deepseek-ai/*`, so the module check below would
 * reject it anyway; the explicit id check keeps the reason accurate.)
 */
export const SELF_IDS: ReadonlySet<string> = new Set(['builtin-toggles'])

/** The module specifier that identifies an official built-in package. */
export const OFFICIAL_PACKAGE_PREFIX = '@deepseek-ai/'

/**
 * Exact Cordis/DSH framework identities, not bare-id heuristics.
 *
 * `cordis:*` is the Loader's builtin specifier scheme, and `loader` is the
 * Cordis Loader service's own module name. These names are stronger evidence
 * than a bare id; a third-party package can still pick the id `include`, but
 * its module name will not be `cordis:include`, so it keeps the `external`
 * reason. The `LOCKED_IDS.has(id)` requirement below prevents an unknown
 * bare-id squat from borrowing the core label.
 */
export const CORDIS_FRAMEWORK_NAMES: ReadonlySet<string> = new Set([
  'loader',
  'cordis:loader',
  'cordis:include',
  'cordis:group',
])

/** Why an entry is not manageable; undefined means it is manageable. */
export type LockReason = 'core' | 'unlisted' | 'external' | 'self' | 'agent-preset'

/** A snapshot row, as served by GET /api/builtin-toggles. */
export interface SnapshotPlugin {
  id: string
  name: string
  disabled: boolean
  phase: string | null
  manageable: boolean
  reason?: LockReason
}

/** Raw loader-entry facts the policy classifies. */
export interface EntryFacts {
  id: string
  name: string
  disabled: boolean
  phase: string | null
}

/** Classify one loader entry against the policy. */
export function classifyEntry(entry: EntryFacts): SnapshotPlugin {
  if (SELF_IDS.has(entry.id)) {
    return { ...entry, manageable: false, reason: 'self' }
  }
  // Framework identity is established by the exact Cordis builtin/service
  // module name AND a known core id. This is not a bare-id shortcut: an
  // external package squatting on a core id keeps the `external` reason.
  if (CORDIS_FRAMEWORK_NAMES.has(entry.name) && LOCKED_IDS.has(entry.id)) {
    return { ...entry, manageable: false, reason: 'core' }
  }
  if (!entry.name.startsWith(OFFICIAL_PACKAGE_PREFIX)) {
    return { ...entry, manageable: false, reason: 'external' }
  }
  if (MANAGEABLE.has(entry.id)) {
    return { ...entry, manageable: true }
  }
  return { ...entry, manageable: false, reason: LOCKED_IDS.has(entry.id) ? 'core' : 'unlisted' }
}

/** Outcome of a POST mutation check. */
export type MutationVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly status: number; readonly code: string; readonly message: string }

/**
 * Server-side gate for POST /api/builtin-toggles/<id>. Re-checks every rule
 * on every request — the UI hiding buttons is never the security boundary.
 * Order matters: the id must be allowlisted before anything is looked up, so
 * an unknown id can never probe the loader or the filesystem.
 */
export function checkMutation(id: string, facts: EntryFacts | undefined, body: unknown): MutationVerdict {
  if (!MANAGEABLE.has(id)) {
    return {
      ok: false,
      status: 403,
      code: 'not_manageable',
      message: `builtin-toggles: ${id} is not on the manageable allowlist`,
    }
  }
  if (!isMutationBody(body)) {
    return {
      ok: false,
      status: 400,
      code: 'invalid_body',
      message: 'builtin-toggles: body must be a legacy { disabled: boolean } object or an explicit mutation action',
    }
  }
  if (facts === undefined) {
    return {
      ok: false,
      status: 404,
      code: 'not_found',
      message: `builtin-toggles: loader entry not found: ${id}`,
    }
  }
  if (!facts.name.startsWith(OFFICIAL_PACKAGE_PREFIX)) {
    return {
      ok: false,
      status: 403,
      code: 'not_official',
      message: `builtin-toggles: ${id} is not an @deepseek-ai/* package`,
    }
  }
  if (SELF_IDS.has(facts.id)) {
    return {
      ok: false,
      status: 403,
      code: 'self',
      message: 'builtin-toggles: the manager cannot toggle itself',
    }
  }
  return { ok: true }
}

/** A validated POST body. */
export interface DisabledBody {
  disabled: boolean
}

export type MutationAction = 'force-enable' | 'force-disable' | 'restore-inheritance'
export interface ActionBody { action: MutationAction }
export type MutationBody = DisabledBody | ActionBody

/** Narrow an unknown parsed JSON value to { disabled: boolean } (strict schema: no extra keys). */
export function parseDisabledBody(value: unknown): DisabledBody | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  const keys = Object.keys(record)
  if (keys.length !== 1 || keys[0] !== 'disabled') return null
  const disabled = record.disabled
  if (typeof disabled !== 'boolean') return null
  return { disabled }
}

/** Strict API schema, retaining the v0.1 `{ disabled }` request form. */
export function parseMutationBody(value: unknown): MutationBody | null {
  const legacy = parseDisabledBody(value)
  if (legacy !== null) return legacy
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (Object.keys(record).length !== 1 || typeof record.action !== 'string') return null
  return record.action === 'force-enable' || record.action === 'force-disable' || record.action === 'restore-inheritance'
    ? { action: record.action }
    : null
}

function isMutationBody(value: unknown): value is MutationBody {
  return parseMutationBody(value) !== null
}
