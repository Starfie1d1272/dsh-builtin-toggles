/**
 * Reviewed, locale-independent facts about the DSH Web Loader composition.
 *
 * This is evidence, not policy: changing any value here must never make a
 * mutation possible. The POST authority remains `policy.ts`.
 */

export type ManagementPlane = 'browser' | 'host' | 'agent-preset' | 'unknown'
export type CapabilityCategory = 'presentation' | 'agent' | 'transport' | 'infrastructure' | 'unknown'

export interface ServiceEvidence {
  /** Loader inject declarations are directly comparable at runtime. */
  kind: 'declared-inject'
  expectedServices: readonly string[]
}

export interface DependencyEvidence {
  /** `unknown` is deliberate: absence was not established by this review. */
  provides: { status: 'observed' | 'unknown'; services?: readonly string[] }
  /** Known consumers are an audit observation, not a complete graph claim. */
  consumers: { status: 'observed' | 'unknown'; ids?: readonly string[] }
}

export type LeafReview = 'reviewed-safe-ui-leaf' | 'locked-dependency' | 'not-reviewed'

export type EvidenceProvenance = 'npm-published-patch' | 'runtime-snapshot'

export interface ReviewedReference {
  /** A published patch and a captured runtime snapshot are intentionally distinct. */
  source: EvidenceProvenance
  packageName: string
  version: string
  artifact: string
}

/** Reviewed release target. Runtime evidence must come from a Host-owned stable seam. */
export interface ReviewedCompositionIdentity {
  kind: 'dsh-release'
  value: string
  provenance: 'npm-published-package'
}

/**
 * The release whose published patches supplied this baseline. This is an
 * expected identity, not proof that the currently running Host exposes it.
 */
export const REVIEWED_RC6_COMPOSITION_IDENTITY: ReviewedCompositionIdentity = {
  kind: 'dsh-release', value: '@deepseek-ai/dsh@0.1.0-rc.6', provenance: 'npm-published-package',
}

export interface ReviewedCapabilityBaseline {
  id: string
  /** Exact module identity from the reviewed published rc.6 patch composition. */
  expectedPackageName: string | null
  managementPlane: ManagementPlane
  category: CapabilityCategory
  serviceEvidence: readonly ServiceEvidence[]
  dependencyEvidence: DependencyEvidence
  leafReview: LeafReview
  reviewedReference: ReviewedReference | null
  rationale: string
}

type ReviewedRc6Row = readonly [id: string, packageName: string, source: ReviewedReference['packageName']]

const BASE_REFERENCE: ReviewedReference = {
  source: 'npm-published-patch', packageName: '@deepseek-ai/dsh-base', version: '0.1.0-rc.6', artifact: 'cordis.patch.yml',
}
const WEB_REFERENCE: ReviewedReference = {
  source: 'npm-published-patch', packageName: '@deepseek-ai/dsh-web-app', version: '0.1.0-rc.6', artifact: 'cordis.patch.yml',
}

/**
 * Exact composition from the published rc.6 base and Web cordis patches.
 * This is a package-patch provenance baseline. It is intentionally not
 * labelled an upstream source snapshot or a live Loader snapshot.
 */
const REVIEWED_RC6_ROWS: readonly ReviewedRc6Row[] = [
  ['timer', '@deepseek-ai/cordis-plugin-timer', '@deepseek-ai/dsh-base'],
  ['hmr', '@deepseek-ai/cordis-plugin-hmr', '@deepseek-ai/dsh-base'],
  ['llm', '@deepseek-ai/dsh-llm', '@deepseek-ai/dsh-base'],
  ['session', '@deepseek-ai/dsh-session', '@deepseek-ai/dsh-base'],
  ['typert', '@deepseek-ai/dsh-typert-registry', '@deepseek-ai/dsh-base'],
  ['typert-loader', '@deepseek-ai/dsh-typert-loader', '@deepseek-ai/dsh-base'],
  ['typert-gateway', '@deepseek-ai/dsh-api-gateway', '@deepseek-ai/dsh-base'],
  ['session-title', '@deepseek-ai/dsh-session-title', '@deepseek-ai/dsh-base'],
  ['session-title-llm', '@deepseek-ai/dsh-session-title-first-prompt-llm', '@deepseek-ai/dsh-base'],
  ['user-questions', '@deepseek-ai/dsh-user-questions', '@deepseek-ai/dsh-base'],
  ['agent', '@deepseek-ai/dsh-agent', '@deepseek-ai/dsh-base'],
  ['agent-default-model', '@deepseek-ai/dsh-agent-default-model', '@deepseek-ai/dsh-base'],
  ['jobs', '@deepseek-ai/dsh-jobs-local', '@deepseek-ai/dsh-base'],
  ['llm-retry', '@deepseek-ai/dsh-llm-retry', '@deepseek-ai/dsh-base'],
  ['settings', '@deepseek-ai/dsh-settings-file', '@deepseek-ai/dsh-base'],
  ['credentials', '@deepseek-ai/dsh-credentials-local', '@deepseek-ai/dsh-base'],
  ['llm-pi-ai', '@deepseek-ai/dsh-llm-pi-ai', '@deepseek-ai/dsh-base'],
  ['session-persistence-jsonl', '@deepseek-ai/dsh-session-persistence-jsonl', '@deepseek-ai/dsh-base'],
  ['attachment-local', '@deepseek-ai/dsh-attachment-local', '@deepseek-ai/dsh-base'],
  ['session-query-sqlite', '@deepseek-ai/dsh-session-query-sqlite', '@deepseek-ai/dsh-base'],
  ['session-projection', '@deepseek-ai/dsh-session-projection', '@deepseek-ai/dsh-base'],
  ['session-telemetry-otel', '@deepseek-ai/dsh-session-telemetry-otel', '@deepseek-ai/dsh-base'],
  ['subprocess', '@deepseek-ai/dsh-subprocess-local', '@deepseek-ai/dsh-base'],
  ['sandbox', '@deepseek-ai/dsh-sandbox-local', '@deepseek-ai/dsh-base'],
  ['sandbox-policy', '@deepseek-ai/dsh-sandbox-policy', '@deepseek-ai/dsh-base'],
  ['bash-sandbox', '@deepseek-ai/dsh-bash-sandbox', '@deepseek-ai/dsh-base'],
  ['pwsh-sandbox', '@deepseek-ai/dsh-pwsh-sandbox', '@deepseek-ai/dsh-base'],
  ['approval', '@deepseek-ai/dsh-user-approval', '@deepseek-ai/dsh-base'],
  ['permission', '@deepseek-ai/dsh-permission-presets', '@deepseek-ai/dsh-base'],
  ['shell-env', '@deepseek-ai/dsh-shell-env', '@deepseek-ai/dsh-base'],
  ['tool-bash', '@deepseek-ai/dsh-tool-bash', '@deepseek-ai/dsh-base'],
  ['tool-pwsh', '@deepseek-ai/dsh-tool-pwsh', '@deepseek-ai/dsh-base'],
  ['tool-jobs', '@deepseek-ai/dsh-tool-jobs', '@deepseek-ai/dsh-base'],
  ['fs-observation-policy', '@deepseek-ai/dsh-fs-observation-policy', '@deepseek-ai/dsh-base'],
  ['tool-fs', '@deepseek-ai/dsh-tool-fs', '@deepseek-ai/dsh-base'],
  ['tool-fs-search', '@deepseek-ai/dsh-tool-fs-search', '@deepseek-ai/dsh-base'],
  ['agent-instructions', '@deepseek-ai/dsh-agent-instructions', '@deepseek-ai/dsh-base'],
  ['skill', '@deepseek-ai/dsh-skill', '@deepseek-ai/dsh-base'],
  ['skill-filesystem', '@deepseek-ai/dsh-skill-filesystem', '@deepseek-ai/dsh-base'],
  ['skill-badge', '@deepseek-ai/dsh-skill-badge', '@deepseek-ai/dsh-base'],
  ['tool-skill', '@deepseek-ai/dsh-tool-skill', '@deepseek-ai/dsh-base'],
  ['commands', '@deepseek-ai/dsh-commands', '@deepseek-ai/dsh-base'],
  ['command-feedback', '@deepseek-ai/dsh-command-feedback', '@deepseek-ai/dsh-base'],
  ['goal', '@deepseek-ai/dsh-goal', '@deepseek-ai/dsh-base'],
  ['goal-round-driver', '@deepseek-ai/dsh-goal-round-driver', '@deepseek-ai/dsh-base'],
  ['command-goal', '@deepseek-ai/dsh-command-goal', '@deepseek-ai/dsh-base'],
  ['plan-mode', '@deepseek-ai/dsh-plan-mode', '@deepseek-ai/dsh-base'],
  ['token-meter', '@deepseek-ai/dsh-token-meter', '@deepseek-ai/dsh-base'],
  ['compaction-basic', '@deepseek-ai/dsh-compaction-basic', '@deepseek-ai/dsh-base'],
  ['command-compact', '@deepseek-ai/dsh-command-compact', '@deepseek-ai/dsh-base'],
  ['subagent', '@deepseek-ai/dsh-subagent', '@deepseek-ai/dsh-base'],
  ['subagent-spawn-in-process', '@deepseek-ai/dsh-subagent-spawn-in-process', '@deepseek-ai/dsh-base'],
  ['subagent-fork-in-process', '@deepseek-ai/dsh-subagent-fork-in-process', '@deepseek-ai/dsh-base'],
  ['tool-subagent-control', '@deepseek-ai/dsh-tool-subagent-control', '@deepseek-ai/dsh-base'],
  ['tool-subagent-list-agents', '@deepseek-ai/dsh-tool-subagent-control/list-agents', '@deepseek-ai/dsh-base'],
  ['tool-subagent', '@deepseek-ai/dsh-tool-subagent', '@deepseek-ai/dsh-base'],
  ['tool-subagent-fork', '@deepseek-ai/dsh-tool-subagent', '@deepseek-ai/dsh-base'],
  ['tool-subagent-report', '@deepseek-ai/dsh-tool-subagent-report', '@deepseek-ai/dsh-base'],
  ['workflow-worker-thread', '@deepseek-ai/dsh-workflow-worker-thread', '@deepseek-ai/dsh-base'],
  ['tool-workflow', '@deepseek-ai/dsh-tool-workflow', '@deepseek-ai/dsh-base'],
  ['timeout-policy', '@deepseek-ai/dsh-tool-call-timeout-policy', '@deepseek-ai/dsh-base'],
  ['spill-local', '@deepseek-ai/dsh-spill-local', '@deepseek-ai/dsh-base'],
  ['spill-policy', '@deepseek-ai/dsh-spill-policy', '@deepseek-ai/dsh-base'],
  ['session-checkpoint-policy', '@deepseek-ai/dsh-session-checkpoint-policy', '@deepseek-ai/dsh-base'],
  ['tool-result-pruner', '@deepseek-ai/dsh-compaction-tool-result-pruner', '@deepseek-ai/dsh-base'],
  ['tool-todo', '@deepseek-ai/dsh-tool-todo', '@deepseek-ai/dsh-base'],
  ['tool-goal', '@deepseek-ai/dsh-tool-goal', '@deepseek-ai/dsh-base'],
  ['tool-ralph', '@deepseek-ai/dsh-tool-ralph', '@deepseek-ai/dsh-base'],
  ['tool-str-replace-editor', '@deepseek-ai/dsh-tool-str-replace-editor', '@deepseek-ai/dsh-base'],
  ['repeat-tool-reminder', '@deepseek-ai/dsh-repeat-tool-reminder', '@deepseek-ai/dsh-base'],
  ['web', '@deepseek-ai/dsh-web', '@deepseek-ai/dsh-base'],
  ['web-search-deepseek', '@deepseek-ai/dsh-web-search-deepseek', '@deepseek-ai/dsh-base'],
  ['tool-web', '@deepseek-ai/dsh-tool-web', '@deepseek-ai/dsh-base'],
  ['tools', '@deepseek-ai/dsh-tools', '@deepseek-ai/dsh-base'],
  ['system-prompt', '@deepseek-ai/dsh-system-prompt', '@deepseek-ai/dsh-base'],
  ['agent-loop', '@deepseek-ai/dsh-agent-loop', '@deepseek-ai/dsh-base'],
  ['fs-sandbox', '@deepseek-ai/dsh-fs-sandbox', '@deepseek-ai/dsh-base'],
  ['llm-deepseek', '@deepseek-ai/dsh-llm-deepseek', '@deepseek-ai/dsh-base'],
  ['code-runtime', '@deepseek-ai/dsh-code-runtime-worker-thread', '@deepseek-ai/dsh-web-app'],
  ['storage', '@deepseek-ai/dsh-storage', '@deepseek-ai/dsh-web-app'],
  ['storage-json', '@deepseek-ai/dsh-storage-json', '@deepseek-ai/dsh-web-app'],
  ['storage-domain', '@deepseek-ai/dsh-storage-domain', '@deepseek-ai/dsh-web-app'],
  ['message-feedback', '@deepseek-ai/dsh-message-feedback', '@deepseek-ai/dsh-web-app'],
  ['session-log-download', '@deepseek-ai/dsh-session-log-export', '@deepseek-ai/dsh-web-app'],
  ['workspace', '@deepseek-ai/dsh-workspace', '@deepseek-ai/dsh-web-app'],
  ['session-projection-cache', '@deepseek-ai/dsh-session-projection-cache', '@deepseek-ai/dsh-web-app'],
  ['session-stats', '@deepseek-ai/dsh-session-stats', '@deepseek-ai/dsh-web-app'],
  ['directory-picker', '@deepseek-ai/dsh-host-directory-picker-auto', '@deepseek-ai/dsh-web-app'],
  ['plugin-inventory', '@deepseek-ai/dsh-host-plugin-inventory', '@deepseek-ai/dsh-web-app'],
  ['api-gateway', '@deepseek-ai/dsh-host-apiproxy', '@deepseek-ai/dsh-web-app'],
  ['cordis-host-runner', '@deepseek-ai/dsh-cordis-host-runner', '@deepseek-ai/dsh-web-app'],
  ['web-startup', '@deepseek-ai/dsh-web-app/startup', '@deepseek-ai/dsh-web-app'],
  ['webserver', '@deepseek-ai/dsh-host-webserver', '@deepseek-ai/dsh-web-app'],
  ['web-runtime', '@deepseek-ai/dsh-web-app', '@deepseek-ai/dsh-web-app'],
  ['client-hmr', '@deepseek-ai/dsh-client-hmr', '@deepseek-ai/dsh-web-app'],
  ['modules', '@deepseek-ai/dsh-client-modules', '@deepseek-ai/dsh-web-app'],
  ['connection', '@deepseek-ai/dsh-client-connection', '@deepseek-ai/dsh-web-app'],
  ['api-remotes', '@deepseek-ai/dsh-api-remotes', '@deepseek-ai/dsh-web-app'],
  ['client-runtime', '@deepseek-ai/dsh-client-runtime', '@deepseek-ai/dsh-web-app'],
  ['cordis-client-runner', '@deepseek-ai/dsh-cordis-client-runner', '@deepseek-ai/dsh-web-app'],
  ['ui-theme', '@deepseek-ai/dsh-client-ui-theme', '@deepseek-ai/dsh-web-app'],
  ['locale', '@deepseek-ai/dsh-client-locale', '@deepseek-ai/dsh-web-app'],
  ['ui-layout', '@deepseek-ai/dsh-client-ui-layout', '@deepseek-ai/dsh-web-app'],
  ['ui-sidebar', '@deepseek-ai/dsh-client-ui-sidebar', '@deepseek-ai/dsh-web-app'],
  ['ui-settings', '@deepseek-ai/dsh-client-ui-settings', '@deepseek-ai/dsh-web-app'],
  ['ui-settings-general', '@deepseek-ai/dsh-client-ui-settings-general', '@deepseek-ai/dsh-web-app'],
  ['ui-settings-models', '@deepseek-ai/dsh-client-ui-settings-models', '@deepseek-ai/dsh-web-app'],
  ['ui-settings-plugin-inventory', '@deepseek-ai/dsh-client-ui-settings-plugin-inventory', '@deepseek-ai/dsh-web-app'],
  ['ui-conversation', '@deepseek-ai/dsh-client-ui-conversation', '@deepseek-ai/dsh-web-app'],
  ['ui-tool', '@deepseek-ai/dsh-client-ui-tool', '@deepseek-ai/dsh-web-app'],
  ['ui-cordis', '@deepseek-ai/dsh-client-ui-cordis', '@deepseek-ai/dsh-web-app'],
  ['ui-workflow-run', '@deepseek-ai/dsh-client-ui-workflow-run', '@deepseek-ai/dsh-web-app'],
  ['ui-deliverables', '@deepseek-ai/dsh-client-ui-deliverables', '@deepseek-ai/dsh-web-app'],
  ['ui-workspace', '@deepseek-ai/dsh-client-ui-workspace', '@deepseek-ai/dsh-web-app'],
  ['ui-input-trigger', '@deepseek-ai/dsh-client-ui-input-trigger', '@deepseek-ai/dsh-web-app'],
  ['ui-commands', '@deepseek-ai/dsh-client-ui-commands', '@deepseek-ai/dsh-web-app'],
  ['ui-skill', '@deepseek-ai/dsh-client-ui-skill', '@deepseek-ai/dsh-web-app'],
  ['ui-subagent', '@deepseek-ai/dsh-client-ui-subagent', '@deepseek-ai/dsh-web-app'],
  ['ui-jobs', '@deepseek-ai/dsh-client-ui-jobs', '@deepseek-ai/dsh-web-app'],
  ['ui-goal', '@deepseek-ai/dsh-client-ui-goal', '@deepseek-ai/dsh-web-app'],
  ['ui-message-feedback', '@deepseek-ai/dsh-client-ui-message-feedback', '@deepseek-ai/dsh-web-app'],
  ['ui-model-selection', '@deepseek-ai/dsh-client-ui-model-selection', '@deepseek-ai/dsh-web-app'],
  ['ui-permission', '@deepseek-ai/dsh-client-ui-permission-presets', '@deepseek-ai/dsh-web-app'],
  ['ui-agent-preset', '@deepseek-ai/dsh-client-ui-agent-preset', '@deepseek-ai/dsh-web-app'],
  ['ui-settings-plugins', '@deepseek-ai/dsh-client-ui-settings-plugins', '@deepseek-ai/dsh-web-app'],
  ['ui-plan', '@deepseek-ai/dsh-client-ui-plan', '@deepseek-ai/dsh-web-app'],
  ['ui-user-questions', '@deepseek-ai/dsh-client-ui-user-questions', '@deepseek-ai/dsh-web-app'],
  ['ui-trajectory', '@deepseek-ai/dsh-client-ui-trajectory', '@deepseek-ai/dsh-web-app'],
  ['agent-presets', '@deepseek-ai/dsh-agent-presets', '@deepseek-ai/dsh-web-app'],
]

export const REVIEWED_DSH_WEB_IDS = REVIEWED_RC6_ROWS.map(([id]) => id)

const REVIEWED_INJECTS: Readonly<Record<string, readonly string[]>> = {
  connection: ['webRuntime'], webserver: ['webStartup'], 'web-runtime': ['webStartup'],
}

/** Explicit audit mapping; no entry name prefix is used to infer a plane. */
const AGENT_PRESET_IDS = new Set([
  'tool-bash', 'tool-pwsh', 'tool-jobs', 'tool-fs', 'tool-fs-search', 'tool-str-replace-editor',
  'skill-filesystem', 'tool-skill', 'tool-goal', 'plan-mode', 'compaction-basic', 'command-compact',
  'tool-result-pruner', 'tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent',
  'tool-subagent-fork', 'workflow-worker-thread', 'tool-workflow', 'tool-ralph', 'agent-instructions',
  'tool-todo', 'tool-web',
])
const HOST_IDS = new Set([
  'code-runtime', 'storage', 'storage-json', 'storage-domain', 'message-feedback', 'session-log-download',
  'workspace', 'session-projection-cache', 'session-stats', 'directory-picker', 'plugin-inventory',
  'api-gateway', 'cordis-host-runner', 'web-startup', 'webserver', 'web-runtime',
])
const BROWSER_IDS = new Set([
  'client-hmr', 'modules', 'connection', 'api-remotes', 'client-runtime', 'cordis-client-runner', 'ui-theme',
  'locale', 'ui-layout', 'ui-sidebar', 'ui-settings', 'ui-settings-general', 'ui-settings-models',
  'ui-settings-plugin-inventory', 'ui-conversation', 'ui-tool', 'ui-cordis', 'ui-workflow-run',
  'ui-deliverables', 'ui-workspace', 'ui-input-trigger', 'ui-commands', 'ui-skill', 'ui-subagent', 'ui-jobs',
  'ui-goal', 'ui-message-feedback', 'ui-model-selection', 'ui-permission', 'ui-agent-preset',
  'ui-settings-plugins', 'ui-plan', 'ui-user-questions', 'ui-trajectory',
])
const SAFE_UI_LEAF_IDS = new Set([
  'ui-deliverables', 'ui-jobs', 'ui-goal', 'ui-message-feedback', 'ui-model-selection', 'ui-agent-preset',
  'ui-skill', 'ui-subagent', 'ui-trajectory',
])

function managementPlaneFor(id: string): ManagementPlane {
  if (AGENT_PRESET_IDS.has(id)) return 'agent-preset'
  if (HOST_IDS.has(id)) return 'host'
  if (BROWSER_IDS.has(id)) return 'browser'
  return 'unknown'
}

function categoryFor(id: string): CapabilityCategory {
  if (SAFE_UI_LEAF_IDS.has(id)) return 'presentation'
  if (AGENT_PRESET_IDS.has(id)) return 'agent'
  if (id === 'webserver' || id === 'web-runtime' || id === 'connection' || id === 'api-remotes') return 'transport'
  return 'unknown'
}

function dependencyEvidenceFor(id: string): DependencyEvidence {
  if (id === 'ui-commands') {
    return {
      provides: { status: 'observed', services: ['commandUi'] },
      consumers: { status: 'observed', ids: ['ui-conversation', 'ui-model-selection', 'ui-permission'] },
    }
  }
  return { provides: { status: 'unknown' }, consumers: { status: 'unknown' } }
}

function leafReviewFor(id: string): LeafReview {
  if (SAFE_UI_LEAF_IDS.has(id)) return 'reviewed-safe-ui-leaf'
  if (id === 'ui-commands') return 'locked-dependency'
  return 'not-reviewed'
}

function rationaleFor(id: string): string {
  if (SAFE_UI_LEAF_IDS.has(id)) return 'Reviewed rc.6 admission audit classified this as a safe UI leaf; this fact does not authorize mutation.'
  if (id === 'ui-commands') return 'Provides commandUi with known consumers; it is not a safe UI leaf.'
  return 'Package composition was reviewed, but no independent safe-leaf conclusion is asserted.'
}

export const REVIEWED_DSH_WEB_BASELINE: readonly ReviewedCapabilityBaseline[] = REVIEWED_RC6_ROWS.map(([id, expectedPackageName, source]) => ({
  id,
  expectedPackageName,
  managementPlane: managementPlaneFor(id),
  category: categoryFor(id),
  serviceEvidence: REVIEWED_INJECTS[id] === undefined ? [] : [{ kind: 'declared-inject', expectedServices: REVIEWED_INJECTS[id] }],
  dependencyEvidence: dependencyEvidenceFor(id),
  leafReview: leafReviewFor(id),
  reviewedReference: source === '@deepseek-ai/dsh-base' ? BASE_REFERENCE : WEB_REFERENCE,
  rationale: rationaleFor(id),
}))

export function baselineById(baseline: readonly ReviewedCapabilityBaseline[] = REVIEWED_DSH_WEB_BASELINE): ReadonlyMap<string, ReviewedCapabilityBaseline> {
  return new Map(baseline.map((entry) => [entry.id, entry]))
}
