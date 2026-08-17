/**
 * Built-in plugin catalog — display-only data layer.
 *
 * This module holds the PRESENTATION metadata for the official DSH Web
 * built-in Loader entries: locale-owned titles, summaries, categories,
 * impact / recommendation copy, lock notes and preset-managed flags.
 *
 * SECURITY BOUNDARY (never cross):
 * - The catalog is display-only. It NEVER grants manageability and it never
 *   carries a `manageable` / `enabled` / `disabled` / `allowToggle` /
 *   `policy` field. Authorization lives exclusively in src/policy.ts
 *   (MANAGEABLE_IDS), which the server re-checks on every POST. The UI must
 *   render a switch only when the server snapshot says `manageable: true`,
 *   never because a catalog entry looks toggleable.
 * - PRESET_MANAGED_IDS here is presentation metadata only: it explains why a
 *   root Loader row is `disabled: true` (the Web composes those capabilities
 *   per Session via Agent Presets). It never participates in POST checks.
 * - Unknown ids fail closed: the server classifies them locked/unlisted, and
 *   the lookup helper returns a generic fallback instead of crashing.
 */

/** Legacy Chinese display categories retained for the display-only catalogs. */
export type BuiltinCategory =
  | '界面功能'
  | '会话与数据'
  | '模型与智能体'
  | '工具与执行'
  | '安全与权限'
  | '系统基础'

/**
 * One catalog entry. Every field affects only rendering; there is no
 * authorization field here by design.
 */
export interface BuiltinCatalogEntry {
  /** Chinese user-facing name, e.g. 目标栏. */
  title: string
  /** One-sentence user-facing summary ("what does it do for me"). */
  summary: string
  /** Small category tag. */
  category: BuiltinCategory
  /** Manageable entries only: what is lost after disabling. */
  impact?: string
  /** Manageable entries only: when to keep it on. */
  recommendation?: string
  /** Locked / special entries: why it stays locked. */
  lockNote?: string
  /** Locked / special entries: a state clarification (e.g. platform or preset). */
  statusNote?: string
  /**
   * Presentation flag: the root Loader row being disabled is NORMAL because
   * the Web composes this capability per Session via Agent Presets. Never
   * interpret root `disabled: true` as "the feature is off". Display-only.
   */
  presetManaged?: boolean
  /** True when the entry fell back to the generic unknown-id copy. */
  unknown?: boolean
}

/**
 * Ids whose root Loader row is disabled by the official Web composition
 * because the capability is assembled per Session via Agent Presets.
 *
 * Display-only metadata: it explains state in the UI and NEVER participates
 * in POST authorization (see policy.ts).
 */
export const PRESET_MANAGED_IDS: readonly string[] = [
  'tool-bash',
  'tool-pwsh',
  'tool-jobs',
  'tool-fs',
  'tool-fs-search',
  'tool-str-replace-editor',
  'skill-filesystem',
  'tool-skill',
  'tool-goal',
  'plan-mode',
  'compaction-basic',
  'command-compact',
  'tool-result-pruner',
  'tool-subagent-control',
  'tool-subagent-list-agents',
  'tool-subagent',
  'tool-subagent-fork',
  'workflow-worker-thread',
  'tool-workflow',
  'tool-ralph',
  'agent-instructions',
  'tool-todo',
  'tool-web',
]

/** O(1) presentation-only membership. */
export const PRESET_MANAGED: ReadonlySet<string> = new Set(PRESET_MANAGED_IDS)

/** Unified copy for preset-managed rows (spec 3.4 / 5H). */
export const PRESET_MANAGED_STATUS_NOTE =
  '网页端顶层停用是正常状态；实际是否可用由当前会话的 Agent 预设决定。'
export const PRESET_MANAGED_LOCK_NOTE =
  '该能力由 Agent 预设组装，不由全局内置插件面板开关。'

/** Fallback copy for official ids without a catalog entry yet (spec 4). */
export const UNKNOWN_FALLBACK_SUMMARY = '当前版本暂无补充说明。'
export const UNKNOWN_FALLBACK_LOCK_NOTE =
  '该条目属于官方内置插件，但尚未收录详细说明，因此保持锁定。'

/**
 * Resolve one entry from a catalog record, falling back to the generic
 * unknown-id copy — never throws, so the UI cannot crash on an entry the
 * catalog has not documented yet. The bound convenience wrapper
 * Locale-bound helpers live in catalog.zh.ts and catalog.en.ts.
 *
 * @param catalog    the display-only catalog record (keyed by loader id)
 * @param id         loader short id (e.g. ui-goal)
 * @param moduleName module/package name (e.g. @deepseek-ai/dsh-client-ui-goal)
 */
export function resolveCatalogEntry(
  catalog: Readonly<Record<string, BuiltinCatalogEntry>>,
  id: string,
  moduleName: string,
): BuiltinCatalogEntry {
  const known = catalog[id]
  if (known !== undefined) return known
  return {
    title: moduleShortName(moduleName),
    summary: UNKNOWN_FALLBACK_SUMMARY,
    category: '系统基础',
    lockNote: UNKNOWN_FALLBACK_LOCK_NOTE,
    unknown: true,
  }
}

/** Derive the short package name, e.g. @deepseek-ai/dsh-client-ui-goal → dsh-client-ui-goal. */
export function moduleShortName(moduleName: string): string {
  const trimmed = moduleName.trim()
  const slash = trimmed.lastIndexOf('/')
  return slash >= 0 ? trimmed.slice(slash + 1) : trimmed
}

/** Normalize a search query / haystack: trim + case-fold (ids are ASCII). */
export function normalizeSearch(input: string): string {
  return input.trim().toLowerCase()
}

/** What a searchable row offers the local search box. */
export interface SearchTarget {
  title: string
  summary: string
  id: string
  moduleName: string
}

/**
 * Local, in-memory matcher: title / summary / loader id / module name.
 * Empty or whitespace query matches everything (restores collapsed state).
 */
export function matchesSearch(query: string, target: SearchTarget): boolean {
  const q = normalizeSearch(query)
  if (q === '') return true
  const haystack = normalizeSearch(
    [target.title, target.summary, target.id, target.moduleName].join(' '),
  )
  return haystack.includes(q)
}
