/** English presentation catalog. It is display/search data only. */
import { moduleShortName, type BuiltinCatalogEntry } from './catalog.ts'

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

/** Only reviewed English copy is present; unknown rows use the honest fallback. */
export const enCatalog: Readonly<Record<string, BuiltinCatalogEntry>> = Object.fromEntries(
  Object.entries(ENGLISH_OVERRIDES).map(([id, entry]) => [id, { ...entry, category: '系统基础' }]),
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
