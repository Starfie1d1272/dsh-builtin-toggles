/**
 * Catalog tests (v0.2.0).
 *
 * The catalog is a display-only layer: it must never influence authorization.
 * These specs pin that boundary down:
 *   1. the 9 manageable ids all have catalog entries;
 *   2. every manageable entry carries title / summary / impact / recommendation;
 *   3. ui-commands has a catalog entry but stays locked and switch-less;
 *   4. every PRESET_MANAGED_IDS id is locked, is tagged presetManaged, and
 *      carries the unified "由 Agent 预设管理" semantics;
 *   5. catalog metadata cannot affect policy — checkMutation still refuses;
 *   6. unknown official ids fall back gracefully (no crash, no switch);
 *   7. search matches title / summary / id / package name, case-insensitively,
 *      and an empty query matches everything;
 *   8. the rc.6 web roster is fully covered by the catalog (documented gap = 0).
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { checkMutation, classifyEntry, MANAGEABLE, MANAGEABLE_IDS, type EntryFacts } from '../src/policy.ts'
import {
  matchesSearch,
  moduleShortName,
  normalizeSearch,
  PRESET_MANAGED_IDS,
  PRESET_MANAGED_LOCK_NOTE,
  PRESET_MANAGED_STATUS_NOTE,
  UNKNOWN_FALLBACK_LOCK_NOTE,
  UNKNOWN_FALLBACK_SUMMARY,
} from '../src/client/catalog.ts'
import { getBuiltinCatalogEntry, zhCatalog } from '../src/client/catalog.zh.ts'

function facts(overrides: Partial<EntryFacts> = {}): EntryFacts {
  return { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active', ...overrides }
}

/** The rc.6 web-profile roster (dsh-base + dsh-web-app bundle layers). */
const RC6_ROSTER: readonly string[] = [
  'agent',
  'agent-default-model',
  'agent-instructions',
  'agent-loop',
  'agent-presets',
  'api-gateway',
  'api-remotes',
  'approval',
  'attachment-local',
  'bash-sandbox',
  'client-hmr',
  'client-runtime',
  'code-runtime',
  'command-compact',
  'command-feedback',
  'command-goal',
  'commands',
  'compaction-basic',
  'connection',
  'cordis-client-runner',
  'cordis-host-runner',
  'credentials',
  'directory-picker',
  'fs-observation-policy',
  'fs-sandbox',
  'goal',
  'goal-round-driver',
  'hmr',
  'jobs',
  'llm',
  'llm-deepseek',
  'llm-pi-ai',
  'llm-retry',
  'locale',
  'message-feedback',
  'modules',
  'permission',
  'plan-mode',
  'plugin-inventory',
  'pwsh-sandbox',
  'repeat-tool-reminder',
  'sandbox',
  'sandbox-policy',
  'session',
  'session-checkpoint-policy',
  'session-log-download',
  'session-persistence-jsonl',
  'session-projection',
  'session-projection-cache',
  'session-query-sqlite',
  'session-stats',
  'session-telemetry-otel',
  'session-title',
  'session-title-llm',
  'settings',
  'shell-env',
  'skill',
  'skill-badge',
  'skill-filesystem',
  'spill-local',
  'spill-policy',
  'storage',
  'storage-domain',
  'storage-json',
  'subagent',
  'subagent-fork-in-process',
  'subagent-spawn-in-process',
  'subprocess',
  'system-prompt',
  'timeout-policy',
  'timer',
  'token-meter',
  'tool-bash',
  'tool-fs',
  'tool-fs-search',
  'tool-goal',
  'tool-jobs',
  'tool-pwsh',
  'tool-ralph',
  'tool-result-pruner',
  'tool-skill',
  'tool-str-replace-editor',
  'tool-subagent',
  'tool-subagent-control',
  'tool-subagent-fork',
  'tool-subagent-list-agents',
  'tool-subagent-report',
  'tool-todo',
  'tool-web',
  'tool-workflow',
  'tools',
  'typert',
  'typert-gateway',
  'typert-loader',
  'ui-agent-preset',
  'ui-commands',
  'ui-conversation',
  'ui-cordis',
  'ui-deliverables',
  'ui-goal',
  'ui-input-trigger',
  'ui-jobs',
  'ui-layout',
  'ui-message-feedback',
  'ui-model-selection',
  'ui-permission',
  'ui-plan',
  'ui-settings',
  'ui-settings-general',
  'ui-settings-models',
  'ui-settings-plugin-inventory',
  'ui-settings-plugins',
  'ui-sidebar',
  'ui-skill',
  'ui-subagent',
  'ui-theme',
  'ui-tool',
  'ui-trajectory',
  'ui-user-questions',
  'ui-workflow-run',
  'ui-workspace',
  'user-questions',
  'web',
  'web-runtime',
  'web-search-deepseek',
  'web-startup',
  'webserver',
  'workflow-worker-thread',
  'workspace',
]

/** Fields a catalog entry is allowed to carry — nothing policy-shaped. */
const ALLOWED_ENTRY_KEYS = new Set([
  'title', 'summary', 'category', 'impact', 'recommendation',
  'lockNote', 'statusNote', 'presetManaged', 'unknown',
])
const FORBIDDEN_ENTRY_KEYS = ['manageable', 'enabled', 'disabled', 'allowToggle', 'policy']

describe('catalog coverage', () => {
  it('1. every MANAGEABLE_IDS id has a real catalog entry (not the fallback)', () => {
    for (const id of MANAGEABLE_IDS) {
      const entry = getBuiltinCatalogEntry(id, `@deepseek-ai/dsh-client-${id.slice(3)}`)
      assert.notEqual(entry.unknown, true, id)
      assert.ok(entry.title.length > 0, id)
      assert.ok(entry.summary.length > 0, id)
    }
  })

  it('2. every manageable entry carries title / summary / impact / recommendation', () => {
    for (const id of MANAGEABLE_IDS) {
      const entry = zhCatalog[id]
      assert.ok(entry !== undefined, id)
      assert.ok(entry.title.length > 0, id)
      assert.ok(entry.summary.length > 0, id)
      assert.ok(entry.impact !== undefined && entry.impact.length > 0, id)
      assert.ok(entry.recommendation !== undefined && entry.recommendation.length > 0, id)
    }
  })

  it('3. ui-commands has a catalog entry, is not manageable, and never gets a switch', () => {
    const entry = zhCatalog['ui-commands']
    assert.ok(entry !== undefined, 'ui-commands must be documented')
    assert.equal(entry.title, '命令界面')
    assert.equal(MANAGEABLE.has('ui-commands'), false, 'ui-commands must NOT be allowlisted')
    const classified = classifyEntry(facts({ id: 'ui-commands', name: '@deepseek-ai/dsh-client-ui-commands' }))
    assert.equal(classified.manageable, false)
    // The UI renders a switch only when the snapshot says manageable: true.
    assert.equal(classified.manageable, false, 'no switch for ui-commands')
    const verdict = checkMutation('ui-commands', facts({ id: 'ui-commands', name: '@deepseek-ai/dsh-client-ui-commands' }), { disabled: true })
    assert.equal(verdict.ok, false)
    if (!verdict.ok) assert.equal(verdict.status, 403)
  })

  it('4. PRESET_MANAGED_IDS: all locked, tagged presetManaged, unified semantics', () => {
    for (const id of PRESET_MANAGED_IDS) {
      assert.equal(MANAGEABLE.has(id), false, id + ' must stay locked')
      const entry = getBuiltinCatalogEntry(id, `@deepseek-ai/dsh-${id}`)
      assert.notEqual(entry.unknown, true, id + ' must not rely on the fallback')
      assert.equal(entry.presetManaged, true, id)
      assert.equal(entry.statusNote, PRESET_MANAGED_STATUS_NOTE, id)
      assert.equal(entry.lockNote, PRESET_MANAGED_LOCK_NOTE, id)
      const classified = classifyEntry(facts({ id, name: `@deepseek-ai/dsh-${id}`, disabled: true }))
      assert.equal(classified.manageable, false, id)
      const verdict = checkMutation(id, facts({ id, name: `@deepseek-ai/dsh-${id}`, disabled: true }), { disabled: true })
      assert.equal(verdict.ok, false, id)
    }
  })

  it('4b. PRESET_MANAGED_IDS and MANAGEABLE_IDS never overlap', () => {
    for (const id of PRESET_MANAGED_IDS) {
      assert.equal(MANAGEABLE.has(id), false, id)
    }
  })

  it('5. catalog metadata cannot affect policy (checkMutation still refuses)', () => {
    // These ids are NOT allowlisted even though the catalog documents them.
    for (const id of ['tool-web', 'tool-bash', 'ui-commands', 'webserver', 'llm']) {
      const verdict = checkMutation(id, facts({ id, name: `@deepseek-ai/dsh-${id}` }), { disabled: true })
      assert.equal(verdict.ok, false, id)
      if (!verdict.ok) assert.equal(verdict.status, 403)
    }
    // A totally unknown id with a (hypothetical) catalog entry still refuses.
    const verdict = checkMutation('future-ui-x', facts({ id: 'future-ui-x', name: '@deepseek-ai/dsh-client-future-ui-x' }), { disabled: true })
    assert.equal(verdict.ok, false)
  })

  it('5b. no catalog entry carries a policy-shaped field', () => {
    for (const [id, entry] of Object.entries(zhCatalog)) {
      for (const key of Object.keys(entry)) {
        assert.ok(ALLOWED_ENTRY_KEYS.has(key), id + ' has forbidden key ' + key)
      }
      for (const key of FORBIDDEN_ENTRY_KEYS) {
        assert.equal((entry as unknown as Record<string, unknown>)[key], undefined, id + ' must not carry ' + key)
      }
    }
  })

  it('6. unknown official ids fall back without crashing and stay switch-less', () => {
    const entry = getBuiltinCatalogEntry('future-ui-x', '@deepseek-ai/dsh-client-future-ui-x')
    assert.equal(entry.unknown, true)
    assert.equal(entry.title, 'dsh-client-future-ui-x')
    assert.equal(entry.summary, UNKNOWN_FALLBACK_SUMMARY)
    assert.equal(entry.lockNote, UNKNOWN_FALLBACK_LOCK_NOTE)
    assert.equal(entry.category, '系统基础')
    // moduleShortName edge cases
    assert.equal(moduleShortName('@deepseek-ai/dsh-client-ui-goal'), 'dsh-client-ui-goal')
    assert.equal(moduleShortName('builtin-toggles'), 'builtin-toggles')
    assert.equal(moduleShortName(''), '')
    // no crash on empty input
    assert.equal(getBuiltinCatalogEntry('', '').unknown, true)
    // the server still classifies it locked/unlisted
    const classified = classifyEntry(facts({ id: 'future-ui-x', name: '@deepseek-ai/dsh-client-future-ui-x' }))
    assert.equal(classified.manageable, false)
    assert.equal(classified.reason, 'unlisted')
  })

  it('7. search: title, summary, id and package name match; case-insensitive; clear restores', () => {
    const goal = getBuiltinCatalogEntry('ui-goal', '@deepseek-ai/dsh-client-ui-goal')
    assert.equal(goal.title, '目标栏')
    // Chinese title keyword
    assert.equal(matchesSearch('模型', {
      title: '模型选择', summary: '提供 /model 和输入区的模型、推理强度选择入口。',
      id: 'ui-model-selection', moduleName: '@deepseek-ai/dsh-client-ui-model-selection',
    }), true)
    // summary keyword
    assert.equal(matchesSearch('后台任务', {
      title: '后台任务列表', summary: '会话存在后台任务时，在页头显示任务状态、详情和运行耗时。',
      id: 'ui-jobs', moduleName: '@deepseek-ai/dsh-client-ui-jobs',
    }), true)
    // loader id
    assert.equal(matchesSearch('ui-goal', {
      title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal',
    }), true)
    // package / module name
    assert.equal(matchesSearch('dsh-client-ui-goal', {
      title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal',
    }), true)
    assert.equal(matchesSearch('dsh-client-ui-goal', {
      title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal',
    }), true)
    // case-insensitive
    assert.equal(matchesSearch('UI-GOAL', {
      title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal',
    }), true)
    assert.equal(matchesSearch('Dsh-Client-Ui-Goal', {
      title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal',
    }), true)
    // normalizeSearch trims + case-folds
    assert.equal(normalizeSearch('  UI-GOAL  '), 'ui-goal')
    // clearing the query restores everything
    assert.equal(matchesSearch('', { title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '' }), true)
    assert.equal(matchesSearch('   ', { title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '' }), true)
    // non-matching query
    assert.equal(matchesSearch('zzz-no-such-thing', { title: goal.title, summary: goal.summary, id: 'ui-goal', moduleName: '@deepseek-ai/dsh-client-ui-goal' }), false)
  })

  it('8. the rc.6 web roster is fully covered by the catalog (no unknown entries)', () => {
    for (const id of RC6_ROSTER) {
      const entry = getBuiltinCatalogEntry(id, `@deepseek-ai/dsh-${id}`)
      assert.notEqual(entry.unknown, true, 'roster id missing from catalog: ' + id)
    }
  })

  it('8b. every PRESET_MANAGED_IDS id appears in the rc.6 roster (documented set)', () => {
    const set = new Set(RC6_ROSTER)
    for (const id of PRESET_MANAGED_IDS) {
      assert.ok(set.has(id), 'preset-managed id not in roster: ' + id)
    }
  })

  it('9. zh catalog keeps Bash/PowerShell and avoids mechanical translation regressions', () => {
    const entries = Object.values(zhCatalog)
    const allCopy = entries.flatMap((entry) => [
      entry.title, entry.summary, entry.impact ?? '', entry.recommendation ?? '',
      entry.lockNote ?? '', entry.statusNote ?? '',
    ]).join('\n')
    assert.doesNotMatch(allCopy, /Power命令行环境/)
    assert.doesNotMatch(allCopy, /命令行环境环境/)
    assert.doesNotMatch(allCopy, /环境执行环境/)

    const pwsh = zhCatalog['pwsh-sandbox']!
    assert.match(pwsh.title, /PowerShell/)
    assert.match(pwsh.summary, /PowerShell/)
    const toolPwsh = zhCatalog['tool-pwsh']!
    assert.match(toolPwsh.title, /PowerShell/)
    assert.match(toolPwsh.summary, /PowerShell/)

    const bash = zhCatalog['bash-sandbox']!
    assert.match(bash.summary, /Bash/)
    const toolBash = zhCatalog['tool-bash']!
    assert.match(toolBash.summary, /Bash/)
  })
})
