/**
 * Composition-scope projection over the public Loader Entry API.
 *
 * DSH composes loader rows from several layers that are all visible through
 * `ctx.loader.entries()` at once:
 *
 *   - the Host/profile composition (bundle patches + profile layers, mounted
 *     under the profile root `Include`), and
 *   - per-session Agent Preset compositions, mounted by
 *     `@deepseek-ai/dsh-agent-presets` as `Include` subtrees owned by the
 *     `agent-presets` entry.
 *
 * A preset and the Host legitimately share ids (`tool-bash`, `plan-mode`, …).
 * The Loader's own public identity — `Entry.id` — already qualifies every
 * entry with its owning-tree chain (`include:tool-bash` vs
 * `include:agent-presets:tool-bash`), and the tree-owner chain is reachable
 * through public fields (`Entry.parent.tree.ctx.fiber.entry`). This module
 * projects exactly that public seam; nothing here reads private fields, file
 * paths, or module-resolution guesses.
 */

import type { Entry } from '@deepseek-ai/cordis-plugin-loader'

/** The two composition planes the inspector can attribute publicly. */
export type CompositionScope = 'host' | 'agent-preset'

/** Exact official module that owns Agent Preset subtrees. */
export const AGENT_PRESET_MODULE = '@deepseek-ai/dsh-agent-presets'

export interface CompositionScopeFacts {
  /** Loader-computed identity, qualified by the owning-tree entry chain. */
  scopeId: string
  /** Public plane attribution derived from the tree-owner chain. */
  compositionScope: CompositionScope
}

/**
 * The Loader's own public identity for one entry: `options.id` prefixed by
 * every owning tree entry (`EntryTree.sep`-joined). Two entries with the same
 * `scopeId` claim the same Loader namespace slot.
 */
export function scopeIdOf(entry: Entry): string {
  return entry.id
}

/**
 * Walk the tree-owner chain through public fields. An entry whose owning tree
 * chain contains the `agent-presets` entry lives in a per-session Agent
 * Preset composition; everything else is Host composition (the root tree, the
 * profile include tree, and any other non-preset subtree).
 */
export function compositionScopeOf(entry: Entry): CompositionScope {
  const visited = new Set<Entry>()
  let owner = entry.parent?.tree?.ctx?.fiber?.entry
  while (owner !== undefined) {
    if (visited.has(owner)) break
    visited.add(owner)
    if (owner.options?.name === AGENT_PRESET_MODULE) return 'agent-preset'
    owner = owner.parent?.tree?.ctx?.fiber?.entry
  }
  return 'host'
}

/** Project both facts from one public Loader entry. */
export function scopedEntryFacts(entry: Entry): CompositionScopeFacts {
  return { scopeId: scopeIdOf(entry), compositionScope: compositionScopeOf(entry) }
}
