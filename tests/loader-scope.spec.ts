/**
 * The composition-scope projection must stay on the public Loader seam:
 * `Entry.id` plus the tree-owner chain reachable through public fields
 * (`Entry.parent.tree.ctx.fiber.entry`). These fixtures shape those objects
 * exactly as the real Loader does.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import { AGENT_PRESET_MODULE, compositionScopeOf, scopedEntryFacts, scopeIdOf } from '../src/loader-scope.ts'

interface TreeLike {
  ctx: { fiber: { entry: EntryLike | undefined } }
}

interface EntryLike {
  id: string
  options: { id: string; name: string }
  parent: { tree: TreeLike }
}

/** Wrap a plain object so it satisfies the public `Entry` type structurally. */
function entryOf(value: EntryLike): Entry {
  return value as unknown as Entry
}

function rootEntry(optionsId: string, name: string): EntryLike {
  const entry: EntryLike = {
    id: optionsId,
    options: { id: optionsId, name },
    parent: { tree: { ctx: { fiber: { entry: undefined } } } },
  }
  return entry
}

function ownedEntry(optionsId: string, name: string, owner: EntryLike): EntryLike {
  const entry: EntryLike = {
    id: `${owner.id}:${optionsId}`,
    options: { id: optionsId, name },
    parent: { tree: { ctx: { fiber: { entry: owner } } } },
  }
  return entry
}

describe('loader composition-scope projection', () => {
  it('uses the Loader-computed Entry.id as the scope identity', () => {
    const include = rootEntry('include', 'cordis:include')
    const hostRow = ownedEntry('tool-bash', '@deepseek-ai/dsh-tool-bash', include)
    assert.equal(scopeIdOf(entryOf(hostRow)), 'include:tool-bash')
    assert.equal(scopedEntryFacts(entryOf(hostRow)).scopeId, 'include:tool-bash')
  })

  it('classifies a profile-include row as host composition', () => {
    const include = rootEntry('include', 'cordis:include')
    const hostRow = ownedEntry('ui-goal', '@deepseek-ai/dsh-client-ui-goal', include)
    assert.equal(compositionScopeOf(entryOf(hostRow)), 'host')
  })

  it('classifies a row under the agent-presets entry as agent-preset composition', () => {
    const include = rootEntry('include', 'cordis:include')
    const presets = ownedEntry('agent-presets', AGENT_PRESET_MODULE, include)
    const presetRow = ownedEntry('tool-bash', '@deepseek-ai/dsh-tool-bash', presets)
    assert.equal(compositionScopeOf(entryOf(presetRow)), 'agent-preset')
    assert.equal(scopedEntryFacts(entryOf(presetRow)).compositionScope, 'agent-preset')
    // The agent-presets plugin row itself is Host composition; only its
    // subtree rows are per-session preset rows.
    assert.equal(compositionScopeOf(entryOf(presets)), 'host')
  })

  it('classifies an unowned root-tree row as host composition', () => {
    const root = rootEntry('timer', '@deepseek-ai/cordis-plugin-timer')
    assert.equal(compositionScopeOf(entryOf(root)), 'host')
    assert.equal(scopeIdOf(entryOf(root)), 'timer')
  })

  it('terminates on a cyclic owner chain instead of looping', () => {
    const self = rootEntry('self', 'cordis:include')
    self.parent.tree.ctx.fiber.entry = self
    assert.equal(compositionScopeOf(entryOf(self)), 'host')
  })
})
