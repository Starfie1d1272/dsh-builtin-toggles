/**
 * Integration coverage for DSH's real profile/HMR recomposition seam.
 *
 * Loader's `entry.update({ disabled: null })` only removes the current option;
 * it does not replay lower profile layers. These tests therefore change the
 * actual profile file through the textual writer and wait for DSH's public
 * `watchUserPatches()` callback to recompose the root Include.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Hmr from '@deepseek-ai/cordis-plugin-hmr'
import TimerService from '@deepseek-ai/cordis-plugin-timer'
import { loadOptionalPatches, mountRootInclude, watchUserPatches } from '@deepseek-ai/dsh-app-boot'
import { describe, it } from 'node:test'
import { restoreDisabledInheritance } from '../src/profile-patch.ts'

interface LiveProfile {
  ctx: Context
  profile: string
  disposeWatch: () => Promise<void>
  dispose: () => Promise<void>
}

function pause(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds))
}

async function waitForDisabled(ctx: Context, expected: boolean): Promise<void> {
  const deadline = Date.now() + 3_000
  while (Date.now() < deadline) {
    await ctx.loader.await()
    const entry = [...ctx.loader.entries()].find((candidate) => candidate.options.id === 'ui-goal')
    if ((entry?.options.disabled === true) === expected) return
    await pause(20)
  }
  const entry = [...ctx.loader.entries()].find((candidate) => candidate.options.id === 'ui-goal')
  assert.fail(`timed out waiting for ui-goal disabled=${expected}; observed ${String(entry?.options.disabled)}`)
}

async function bootLiveProfile(lowerDisabled: boolean | undefined): Promise<LiveProfile> {
  const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-hmr-'))
  const config = join(dir, 'cordis.yml')
  const profile = join(dir, 'cordis.patch.yml')
  const leaf = join(dir, 'leaf.mjs')
  writeFileSync(leaf, 'export function apply() {}\n', 'utf8')
  writeFileSync(config, '- id: ui-goal\n  name: ./leaf.mjs\n', 'utf8')
  // The initial explicit false exercises an enabled user override over a
  // disabled lower layer. `[]` is also the ordinary default-enabled case.
  writeFileSync(profile, '- id: ui-goal\n  disabled: false\n', 'utf8')

  const ctx = new Context()
  ctx.baseUrl = pathToFileURL(`${dir}/`).href
  const loaderFiber = await ctx.plugin(Loader)
  const timerFiber = await ctx.plugin(TimerService)
  const hmrFiber = await ctx.plugin(Hmr, { root: [], debounce: 5, ignored: [] })
  const lower = lowerDisabled === undefined ? [] : [{ id: 'ui-goal', disabled: lowerDisabled }]
  await mountRootInclude(ctx, config, [...lower, ...(loadOptionalPatches('test', profile) ?? [])])
  await ctx.loader.await()
  const disposeWatch = await watchUserPatches(ctx, {
    binName: 'test',
    filename: profile,
    compose: (user) => [...lower, ...user],
  })
  await waitForDisabled(ctx, false)
  return {
    ctx,
    profile,
    disposeWatch,
    dispose: async () => {
      await hmrFiber.dispose()
      await timerFiber.dispose()
      await loaderFiber.dispose()
    },
  }
}

describe('DSH profile/HMR restore inheritance integration', () => {
  it('removes an explicit enabled profile override and restores lower disabled:true', async () => {
    const live = await bootLiveProfile(true)
    try {
      assert.equal([...live.ctx.loader.entries()].find((entry) => entry.options.id === 'ui-goal')?.options.disabled, false)
      await restoreDisabledInheritance(live.profile, 'ui-goal')
      await waitForDisabled(live.ctx, true)
      assert.equal(loadOptionalPatches('test', live.profile)?.length, 0)
    } finally {
      await live.disposeWatch()
      await live.dispose()
    }
  })

  it('keeps a normal safe leaf enabled when no lower disabled override exists', async () => {
    const live = await bootLiveProfile(undefined)
    try {
      await restoreDisabledInheritance(live.profile, 'ui-goal')
      await waitForDisabled(live.ctx, false)
      assert.equal(loadOptionalPatches('test', live.profile)?.length, 0)
    } finally {
      await live.disposeWatch()
      await live.dispose()
    }
  })
})
