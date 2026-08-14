/** Locale-aware presentation only. It never decides policy or runtime state. */
import type { BuiltinCatalogEntry } from './catalog.ts'
import { moduleShortName } from './catalog.ts'
import { getEnglishCatalogEntry } from './catalog.en.ts'
import { getBuiltinCatalogEntry } from './catalog.zh.ts'

export type PresentationLocale = 'zh' | 'en'
export interface CapabilityPresentation { title: string; summary: string; unknown: boolean }

export function getCapabilityPresentation(locale: PresentationLocale, capability: { id: string; packageName: string; official: boolean }): CapabilityPresentation {
  if (!capability.official) return fallback(locale, capability.packageName)
  const entry = locale === 'en'
    ? getEnglishCatalogEntry(capability.id, capability.packageName)
    : getBuiltinCatalogEntry(capability.id, capability.packageName)
  return fromCatalog(entry)
}

function fromCatalog(entry: BuiltinCatalogEntry): CapabilityPresentation {
  return { title: entry.title, summary: entry.summary, unknown: entry.unknown === true }
}

function fallback(locale: PresentationLocale, packageName: string): CapabilityPresentation {
  return {
    title: moduleShortName(packageName),
    summary: locale === 'zh' ? '此 capability 没有可用的本地化展示说明。' : 'No localized presentation description is available for this capability.',
    unknown: true,
  }
}
