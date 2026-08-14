/**
 * Reviewed, locale-independent facts about the DSH Web Loader composition.
 *
 * This is evidence, not policy: changing any value here must never make a
 * mutation possible.  The POST authority remains `policy.ts`.
 */

import { MANAGEABLE } from './policy.ts'

export type ManagementPlane = 'browser' | 'host' | 'agent-preset' | 'agent' | 'unknown'
export type CapabilityCategory =
  | 'presentation'
  | 'settings'
  | 'conversation'
  | 'workflow'
  | 'tooling'
  | 'agent'
  | 'storage'
  | 'transport'
  | 'infrastructure'
  | 'unknown'
export type DocumentedPolicyStatus = 'manageable' | 'locked'

export interface ServiceEvidence {
  /** Only Loader `inject` declarations are runtime-checkable in this PR. */
  kind: 'declared-inject'
  expectedServices: readonly string[]
}

export interface ReviewedReference {
  source: 'npm-published-patch'
  packageName: '@deepseek-ai/dsh-web-app'
  version: '0.1.0-rc.6'
  artifact: 'cordis.patch.yml'
}

export interface ReviewedCapabilityBaseline {
  id: string
  /** Exact official module identity when it was directly reviewed; null is honest unknown. */
  expectedPackageName: string | null
  managementPlane: ManagementPlane
  category: CapabilityCategory
  /** A descriptive policy projection only; it is not consulted by POST. */
  documentedPolicyStatus: DocumentedPolicyStatus
  serviceEvidence: readonly ServiceEvidence[]
  /** Null when this plugin did not independently recover a source reference. */
  reviewedReference: ReviewedReference | null
  rationale: string
}

/**
 * The reviewed rc.6 Web composition roster. The list is deliberately kept as
 * ids even when a package identity was not independently verified: presence
 * is still a meaningful, runtime-checkable composition assertion.
 */
export const REVIEWED_DSH_WEB_IDS = [
  'agent', 'agent-default-model', 'agent-instructions', 'agent-loop', 'agent-presets',
  'api-gateway', 'api-remotes', 'approval', 'attachment-local', 'bash-sandbox',
  'client-hmr', 'client-runtime', 'code-runtime', 'command-compact', 'command-feedback',
  'command-goal', 'commands', 'compaction-basic', 'connection', 'cordis-client-runner',
  'cordis-host-runner', 'credentials', 'directory-picker', 'fs-observation-policy',
  'fs-sandbox', 'goal', 'goal-round-driver', 'hmr', 'jobs', 'llm', 'llm-deepseek',
  'llm-pi-ai', 'llm-retry', 'locale', 'message-feedback', 'modules', 'permission',
  'plan-mode', 'plugin-inventory', 'pwsh-sandbox', 'repeat-tool-reminder', 'sandbox',
  'sandbox-policy', 'session', 'session-checkpoint-policy', 'session-log-download',
  'session-persistence-jsonl', 'session-projection', 'session-projection-cache',
  'session-query-sqlite', 'session-stats', 'session-telemetry-otel', 'session-title',
  'session-title-llm', 'settings', 'shell-env', 'skill', 'skill-badge',
  'skill-filesystem', 'spill-local', 'spill-policy', 'storage', 'storage-domain',
  'storage-json', 'subagent', 'subagent-fork-in-process', 'subagent-spawn-in-process',
  'subprocess', 'system-prompt', 'timeout-policy', 'timer', 'token-meter', 'tool-bash',
  'tool-fs', 'tool-fs-search', 'tool-goal', 'tool-jobs', 'tool-pwsh', 'tool-ralph',
  'tool-result-pruner', 'tool-skill', 'tool-str-replace-editor', 'tool-subagent',
  'tool-subagent-control', 'tool-subagent-fork', 'tool-subagent-list-agents',
  'tool-subagent-report', 'tool-todo', 'tool-web', 'tool-workflow', 'tools', 'typert',
  'typert-gateway', 'typert-loader', 'ui-agent-preset', 'ui-commands', 'ui-conversation',
  'ui-cordis', 'ui-deliverables', 'ui-goal', 'ui-input-trigger', 'ui-jobs', 'ui-layout',
  'ui-message-feedback', 'ui-model-selection', 'ui-permission', 'ui-plan', 'ui-settings',
  'ui-settings-general', 'ui-settings-models', 'ui-settings-plugin-inventory',
  'ui-settings-plugins', 'ui-sidebar', 'ui-skill', 'ui-subagent', 'ui-theme', 'ui-tool',
  'ui-trajectory', 'ui-user-questions', 'ui-workflow-run', 'ui-workspace',
  'user-questions', 'web', 'web-runtime', 'web-search-deepseek', 'web-startup', 'webserver',
  'workflow-worker-thread', 'workspace',
] as const

/** Exact names copied from the published `@deepseek-ai/dsh-web-app@0.1.0-rc.6` patch. */
const REVIEWED_WEB_PACKAGE_NAMES: Readonly<Record<string, string>> = {
  'api-gateway': '@deepseek-ai/dsh-host-apiproxy',
  'api-remotes': '@deepseek-ai/dsh-api-remotes',
  'client-hmr': '@deepseek-ai/dsh-client-hmr',
  'client-runtime': '@deepseek-ai/dsh-client-runtime',
  'connection': '@deepseek-ai/dsh-client-connection',
  'cordis-client-runner': '@deepseek-ai/dsh-cordis-client-runner',
  'cordis-host-runner': '@deepseek-ai/dsh-cordis-host-runner',
  'directory-picker': '@deepseek-ai/dsh-host-directory-picker-auto',
  'modules': '@deepseek-ai/dsh-client-modules',
  'plugin-inventory': '@deepseek-ai/dsh-host-plugin-inventory',
  'web-runtime': '@deepseek-ai/dsh-web-app',
  'web-startup': '@deepseek-ai/dsh-web-app/startup',
  'webserver': '@deepseek-ai/dsh-host-webserver',
  'ui-agent-preset': '@deepseek-ai/dsh-client-ui-agent-preset',
  'ui-commands': '@deepseek-ai/dsh-client-ui-commands',
  'ui-conversation': '@deepseek-ai/dsh-client-ui-conversation',
  'ui-cordis': '@deepseek-ai/dsh-client-ui-cordis',
  'ui-deliverables': '@deepseek-ai/dsh-client-ui-deliverables',
  'ui-goal': '@deepseek-ai/dsh-client-ui-goal',
  'ui-input-trigger': '@deepseek-ai/dsh-client-ui-input-trigger',
  'ui-jobs': '@deepseek-ai/dsh-client-ui-jobs',
  'ui-layout': '@deepseek-ai/dsh-client-ui-layout',
  'ui-message-feedback': '@deepseek-ai/dsh-client-ui-message-feedback',
  'ui-model-selection': '@deepseek-ai/dsh-client-ui-model-selection',
  'ui-permission': '@deepseek-ai/dsh-client-ui-permission-presets',
  'ui-plan': '@deepseek-ai/dsh-client-ui-plan',
  'ui-settings': '@deepseek-ai/dsh-client-ui-settings',
  'ui-settings-general': '@deepseek-ai/dsh-client-ui-settings-general',
  'ui-settings-models': '@deepseek-ai/dsh-client-ui-settings-models',
  'ui-settings-plugin-inventory': '@deepseek-ai/dsh-client-ui-settings-plugin-inventory',
  'ui-settings-plugins': '@deepseek-ai/dsh-client-ui-settings-plugins',
  'ui-sidebar': '@deepseek-ai/dsh-client-ui-sidebar',
  'ui-skill': '@deepseek-ai/dsh-client-ui-skill',
  'ui-subagent': '@deepseek-ai/dsh-client-ui-subagent',
  'ui-theme': '@deepseek-ai/dsh-client-ui-theme',
  'ui-tool': '@deepseek-ai/dsh-client-ui-tool',
  'ui-trajectory': '@deepseek-ai/dsh-client-ui-trajectory',
  'ui-user-questions': '@deepseek-ai/dsh-client-ui-user-questions',
  'ui-workflow-run': '@deepseek-ai/dsh-client-ui-workflow-run',
  'ui-workspace': '@deepseek-ai/dsh-client-ui-workspace',
}

const REVIEWED_INJECTS: Readonly<Record<string, readonly string[]>> = {
  connection: ['webRuntime'],
  'web-runtime': ['webStartup'],
  webserver: ['webStartup'],
}

const PUBLISHED_WEB_REFERENCE: ReviewedReference = {
  source: 'npm-published-patch',
  packageName: '@deepseek-ai/dsh-web-app',
  version: '0.1.0-rc.6',
  artifact: 'cordis.patch.yml',
}

function managementPlaneFor(id: string): ManagementPlane {
  if (id.startsWith('ui-') || ['client-hmr', 'client-runtime', 'connection', 'cordis-client-runner', 'locale', 'modules'].includes(id)) return 'browser'
  if (id === 'agent-presets' || id.startsWith('tool-') || id.startsWith('skill-') || id.startsWith('subagent') || id.startsWith('agent-')) return 'agent-preset'
  if (['agent', 'commands', 'goal', 'jobs', 'llm', 'plan-mode', 'tools'].includes(id)) return 'agent'
  if (id.includes('web') || id.includes('server') || id.includes('storage') || id.includes('session') || id.includes('runtime') || id.includes('gateway')) return 'host'
  return 'unknown'
}

function categoryFor(id: string): CapabilityCategory {
  if (id.startsWith('ui-')) return id.includes('settings') ? 'settings' : 'presentation'
  if (id.startsWith('tool-') || id.startsWith('skill-') || id === 'tools') return 'tooling'
  if (id.startsWith('agent') || id.startsWith('subagent') || id === 'plan-mode') return 'agent'
  if (id.startsWith('session') || id.startsWith('storage') || id === 'workspace') return 'storage'
  if (id.includes('web') || id.includes('gateway') || id === 'connection' || id === 'api-remotes') return 'transport'
  if (id.includes('workflow') || id === 'jobs') return 'workflow'
  if (id === 'llm' || id.startsWith('llm-') || id === 'goal' || id === 'commands') return 'conversation'
  return 'infrastructure'
}

function policyFor(id: string): DocumentedPolicyStatus {
  return MANAGEABLE.has(id) ? 'manageable' : 'locked'
}

export const REVIEWED_DSH_WEB_BASELINE: readonly ReviewedCapabilityBaseline[] = REVIEWED_DSH_WEB_IDS.map((id) => {
  const expectedServices = REVIEWED_INJECTS[id]
  const policyStatus = policyFor(id)
  return {
    id,
    expectedPackageName: REVIEWED_WEB_PACKAGE_NAMES[id] ?? null,
    managementPlane: managementPlaneFor(id),
    category: categoryFor(id),
    documentedPolicyStatus: policyStatus,
    serviceEvidence: expectedServices === undefined ? [] : [{ kind: 'declared-inject', expectedServices }],
    reviewedReference: REVIEWED_WEB_PACKAGE_NAMES[id] === undefined ? null : PUBLISHED_WEB_REFERENCE,
    rationale: policyStatus === 'manageable'
      ? 'Explicit server policy allowlist; this reviewed description does not authorize mutation.'
      : 'Not on the explicit server allowlist; reviewed metadata cannot authorize mutation.',
  }
})

export function baselineById(baseline: readonly ReviewedCapabilityBaseline[] = REVIEWED_DSH_WEB_BASELINE): ReadonlyMap<string, ReviewedCapabilityBaseline> {
  return new Map(baseline.map((entry) => [entry.id, entry]))
}
