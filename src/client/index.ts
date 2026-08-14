/**
 * dsh-builtin-toggles — Browser half.
 *
 * Registers the "内置插件 / Built-ins" tab into the official Plugins settings
 * section via `settings.plugins.tab` (the canonical extension point — NOT a
 * new settings.section). Everything else comes from the host half's same-origin
 * API; the tab itself holds no state beyond the last snapshot. The display-only
 * catalog (catalog.ts / catalog.zh.ts) annotates every row.
 */

import type {} from '@deepseek-ai/dsh-client-locale/client'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { BuiltinTogglesTab } from './BuiltinTogglesTab.tsx'
import { en, zh, type BuiltinTogglesLocaleKey } from './locales.ts'

export type { BuiltinTogglesTabProps } from './BuiltinTogglesTab.tsx'
export type { Capability, InspectionSnapshot, InspectorFilters, MutationAction } from './inspector-model.ts'
export type { BuiltinTogglesLocaleKey } from './locales.ts'
export type { BuiltinCatalogEntry, BuiltinCategory, SearchTarget } from './catalog.ts'
export {
  PRESET_MANAGED,
  PRESET_MANAGED_IDS,
  matchesSearch,
  moduleShortName,
  normalizeSearch,
  resolveCatalogEntry,
} from './catalog.ts'
export { getBuiltinCatalogEntry } from './catalog.zh.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Built-ins tab copy owned by this plugin. */
    'settings.builtins': BuiltinTogglesLocaleKey
  }
}

/** Dictionary namespace owned by this plugin. */
export const NS = 'settings.builtins'

/** Services required by the Settings registration. */
export const inject = ['slots', 'locale']

/** Contribute the lazy Built-ins tab to the Plugins settings section. */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'builtin-toggles: dictionaries')

  const t = ctx.locale.bind(NS)

  ctx.slots.inject('settings.plugins.tab', () => ctx.slots.register({
    name: 'settings.plugins.tab',
    id: 'builtins',
    order: 20,
    label: () => t('tab'),
    locale: NS,
    inject: () => ({}),
  }, BuiltinTogglesTab))
}
