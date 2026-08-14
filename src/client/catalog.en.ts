/** English presentation catalog. It is display/search data only. */
import { moduleShortName, type BuiltinCatalogEntry } from './catalog.ts'
import { zhCatalog } from './catalog.zh.ts'

function titleFor(id: string): string {
  return id.split('-').filter(Boolean).map((part) => part.length <= 3 ? part.toUpperCase() : part[0]!.toUpperCase() + part.slice(1)).join(' ')
}

function summaryFor(id: string): string {
  if (id.startsWith('ui-')) return 'Provides the corresponding interface in DSH Web.'
  if (id.startsWith('tool-')) return 'Provides an Agent tool capability assembled by the active preset.'
  if (id.startsWith('skill-')) return 'Provides infrastructure for Skills in the active Agent composition.'
  if (id.startsWith('api-')) return 'Provides an internal API capability for the DSH Web composition.'
  if (id.startsWith('client-')) return 'Provides browser-runtime infrastructure for DSH Web.'
  return 'Provides an official built-in capability in the DSH Web composition.'
}

const ENGLISH_OVERRIDES: Readonly<Record<string, Pick<BuiltinCatalogEntry, 'title' | 'summary'>>> = {
  'ui-deliverables': { title: 'Deliverables', summary: 'Lists files created or changed in the current response and makes recognized references clickable.' },
  'ui-jobs': { title: 'Background jobs', summary: 'Shows background task status, details, and elapsed time in the conversation header.' },
  'ui-goal': { title: 'Goal bar', summary: 'Shows the current Goal near the composer and provides controls to edit, pause, resume, or clear it.' },
  'ui-message-feedback': { title: 'Message feedback', summary: 'Shows thumbs-up, thumbs-down, and optional feedback notes on completed assistant replies.' },
  'ui-model-selection': { title: 'Model selection', summary: 'Provides model and reasoning-effort selection through /model and the composer.' },
  'ui-agent-preset': { title: 'Agent presets', summary: 'Lets users choose and inspect the Agent Preset used for new conversations.' },
  'ui-skill': { title: 'Skill entry points', summary: 'Adds available Skills to command/input menus and renders Skill tool calls.' },
  'ui-subagent': { title: 'Subagent UI', summary: 'Shows the subagent tree and navigation controls in the conversation header.' },
  'ui-trajectory': { title: 'Execution trajectory', summary: 'Displays turn-by-turn user, assistant, and tool events for execution inspection.' },
}

/** Mirrors the known Chinese catalog ids while keeping English copy locale-owned. */
export const enCatalog: Readonly<Record<string, BuiltinCatalogEntry>> = Object.fromEntries(
  Object.keys(zhCatalog).map((id) => [id, { ...ENGLISH_OVERRIDES[id], title: ENGLISH_OVERRIDES[id]?.title ?? titleFor(id), summary: ENGLISH_OVERRIDES[id]?.summary ?? summaryFor(id), category: '系统基础' }]),
)

export function getEnglishCatalogEntry(id: string, moduleName: string): BuiltinCatalogEntry {
  const known = enCatalog[id]
  if (known !== undefined) return known
  return {
    title: moduleShortName(moduleName),
    summary: 'No reviewed presentation description is available for this capability.',
    category: '系统基础', unknown: true,
  }
}
