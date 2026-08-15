/**
 * Reviewed rc.6 integration smoke: the real scoped-composition scenario.
 *
 * Boots the reviewed DSH Web composition from an isolated npm install
 * (`--install`), mounts the shipped `standard` Agent Preset through the real
 * `dsh-agent-presets` service (the exact standing-mount path a running
 * session takes), then projects the live loader entries through this
 * plugin's own scope model and evaluator.
 *
 * Assertions (the regression this hotfix exists for):
 *   - legal cross-scope same ids (Host + standard Agent Preset) produce no
 *     duplicate drift and no new-official-entry drift;
 *   - compatibility is `unverified` (identity unavailable), not `drifted`;
 *   - the nine reviewed manageable UI leaves stay eligible;
 *   - preset rows are attributed to the agent-preset composition scope and
 *     never become host-manageable.
 *
 * Usage:
 *   pnpm tsx scripts/rc6-scoped-smoke.ts --install <isolated-install-dir>
 *     [--home <dsh-home-dir>]
 *
 * `<isolated-install-dir>` must contain `node_modules/@deepseek-ai/dsh` and
 * every reviewed rc.6 package (the `fixtures/reviewed-rc6-runtime` npm
 * install). `--home` defaults to a fresh temporary DSH home.
 */

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildInspectionResponse, type InspectionRuntimeEntry } from '../src/inspection.ts'
import { scopedEntryFacts } from '../src/loader-scope.ts'
import { MANAGEABLE_IDS } from '../src/policy.ts'
import { inspectProfileSnapshot, profilePatchPath } from '../src/profile-patch.ts'

interface Args { install: string; home: string }
function parseArgs(argv: readonly string[]): Args {
  const args: Args = { install: '', home: mkdtempSync(join(tmpdir(), 'builtin-toggles-rc6-smoke-')) }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--install') args.install = argv[++index] ?? ''
    else if (flag === '--home') args.home = argv[++index] ?? ''
  }
  if (args.install === '') throw new Error('--install <dir> is required (isolated rc.6 install with node_modules)')
  return args
}

const { install, home } = parseArgs(process.argv.slice(2))
// Accept either a directory containing `node_modules/@deepseek-ai/*` (an
// npm/pnpm install root), the packages root itself (a global `node_modules`
// dir), or the `@deepseek-ai/dsh` package directory with its bundled
// dependency closure in `node_modules`.
const installNodeModules = join(install, 'node_modules')
const bundledClosure = join(installNodeModules, '@deepseek-ai', 'dsh', 'node_modules')
const appBootRoot = [installNodeModules, install, bundledClosure]
  .find((dir) => existsSync(join(dir, '@deepseek-ai', 'dsh-app-boot', 'lib', 'index.js')))
if (appBootRoot === undefined) throw new Error(`--install ${install} does not contain @deepseek-ai/dsh-app-boot`)
const isDshPackage = existsSync(join(install, 'package.json'))
  && JSON.parse(readFileSync(join(install, 'package.json'), 'utf8')).name === '@deepseek-ai/dsh'
const dshRoot = isDshPackage ? install
  : [installNodeModules, install, bundledClosure]
    .find((dir) => existsSync(join(dir, '@deepseek-ai', 'dsh', 'package.json')) && existsSync(join(dir, '@deepseek-ai', 'dsh', 'config', 'agent-presets')))
if (dshRoot === undefined) throw new Error(`--install ${install} does not contain the shipped agent-preset config`)
// The DSH package directory, however it was located: its `config/` ships the
// agent-preset roots, and `config/agent-presets/` is a SIBLING of that
// package dir, not of its parent.
const dshPackageDir = isDshPackage ? dshRoot : join(dshRoot, '@deepseek-ai', 'dsh')
const installAnchor = join(dshPackageDir, 'package.json')
const shippedPresetRoot = fileURLToPath(new URL('config/agent-presets/', pathToFileURL(`${dshPackageDir}/`)))

async function importFromPackages<T extends object>(specifier: string): Promise<T> {
  return import(pathToFileURL(join(appBootRoot, specifier)).href) as Promise<T>
}

const appBoot = await importFromPackages<{
  boot: (binName: string, config: string, patches: readonly unknown[] | undefined, prepare?: (ctx: never) => unknown, bareModuleBaseUrl?: string) => Promise<never>
  composeEntries: (layers: readonly unknown[][]) => Array<Record<string, unknown>>
  healProfilesModuleFallback: (anchor: string, dshHome?: string) => void
  initProfile: (dir: string, bundles: readonly string[]) => void
  loadOptionalPatches: (binName: string, file: string) => Array<Record<string, unknown>> | undefined
  loadProfile: (binName: string, name: string, anchor: string, dshHome?: string, options?: { userLayer?: boolean }) => { dir: string; layers: Array<{ patches: Array<Record<string, unknown>> }>; patchPath: string }
  PROFILE_PATCH_FILENAME: string
}>('@deepseek-ai/dsh-app-boot/lib/index.js')

const launchEnv = await importFromPackages<{
  createLaunchEnvironmentSnapshot: (layers: readonly { source: string; values: Record<string, string> }[]) => unknown
  DSH_LAUNCH_ENVIRONMENT_KEY: string
}>('@deepseek-ai/dsh-launch-environment/lib/index.js')

const cmdline = await importFromPackages<{
  provideCmdline: (ctx: never, host: { args: readonly string[]; exit: (code: number) => void }) => void
}>('@deepseek-ai/dsh-cmdline/lib/index.js')

// A fresh profile under the (possibly temporary) DSH home; nothing outside it
// is touched. The reviewed bundles compose the Host; the plugin is imported
// from this repository, not mounted as a bundle.
const profileName = 'web'
appBoot.healProfilesModuleFallback(installAnchor, home)
appBoot.initProfile(join(home, 'profiles', profileName), ['@deepseek-ai/dsh-base', '@deepseek-ai/dsh-web-app'])
const profile = appBoot.loadProfile('dsh', profileName, installAnchor, home, { userLayer: true })
const rootConfig = join(profile.dir, 'cordis.yml')
writeFileSync(rootConfig, '# smoke root\n[]\n', 'utf8')

const homePatches = appBoot.loadOptionalPatches('dsh', join(home, appBoot.PROFILE_PATCH_FILENAME)) ?? []
const bundlePatches = profile.layers.flatMap((layer) => layer.patches)
const rows = new Map<string, unknown>()
for (const row of appBoot.composeEntries([bundlePatches, homePatches])) {
  if (typeof row.id === 'string') rows.set(row.id, row)
}
const overlays: Array<Record<string, unknown>> = []
if (rows.has('agent-presets')) {
  overlays.push({
    id: 'agent-presets',
    config: { ...(rows.get('agent-presets') as { config?: Record<string, unknown> })?.config, roots: [{ path: shippedPresetRoot, trust: 'system' }] },
  })
}
// Deterministic port: the smoke runs beside other services in CI.
overlays.push({ id: 'webserver', config: { host: '127.0.0.1', port: 0 } })
const allPatches = [...bundlePatches, ...(appBoot.loadOptionalPatches('dsh', profile.patchPath) ?? []), ...homePatches, ...overlays]

process.env.DSH_HOME = home
const environment = launchEnv.createLaunchEnvironmentSnapshot([{ source: 'process', values: { ...process.env } }])
const ctx = await appBoot.boot('dsh', rootConfig, structuredClone(allPatches), (hostCtx: never) => {
  ;(hostCtx as { provide: (key: string, value: unknown) => void }).provide(launchEnv.DSH_LAUNCH_ENVIRONMENT_KEY, environment)
  cmdline.provideCmdline(hostCtx, { args: [], exit: (code: number) => { process.exitCode = code } })
})

// The exact public path a running session takes: resolve the standing mount of
// the preset named by the reviewed composition's `default: standard`.
const agentPresets = (ctx as { agentPresets: { standingKeyFor: (id: string) => Promise<unknown> } }).agentPresets
assert.ok(agentPresets, 'agentPresets service must be mounted')
await agentPresets.standingKeyFor('standard')

const entries = [...(ctx as { loader: { entries: () => Iterable<never> } }).loader.entries()]
const inspectionEntries: InspectionRuntimeEntry[] = entries
  .filter((entry) => (entry as { options: { group?: boolean } }).options.group !== true)
  .map((entry) => {
    const facts = entry as {
      options: { id: string; name: string; disabled?: unknown }
      disabled: boolean
      fiber?: { state: number }
    }
    return {
      id: facts.options.id,
      name: facts.options.name,
      disabled: facts.disabled,
      phase: fiberPhase(facts.fiber?.state),
      declaredInject: declaredInjectEvidence(facts.options),
      declaredInjectKnown: true,
      ownDisabled: typeof facts.options.disabled === 'boolean' ? facts.options.disabled : undefined,
      ...scopedEntryFacts(entry),
    }
  })

const response = buildInspectionResponse(
  inspectionEntries,
  null,
  inspectProfileSnapshot(profilePatchPath(profileName), inspectionEntries.map((entry) => entry.id)),
  'allowed',
)

const findings = response.compatibility.findings
const duplicateFindings = findings.filter((finding) => finding.code === 'duplicate_runtime_id')
const newOfficialFindings = findings.filter((finding) => finding.code === 'new_official_entry')

assert.equal(response.compatibility.runtimeIdentity.status, 'unavailable', 'rc.6 exposes no host release identity')
assert.equal(response.compatibility.status, 'unverified', 'legal Host + Agent Preset composition must not drift')
assert.equal(response.compatibility.driftedCount, 0, `unexpected drift findings: ${JSON.stringify(findings)}`)
assert.deepEqual(duplicateFindings, [], 'legal cross-scope same ids must not be flagged as duplicates')
assert.deepEqual(newOfficialFindings, [], 'per-session preset rows must not be flagged as new official entries')

const presetRows = response.capabilities.filter((capability) => capability.compositionScope === 'agent-preset')
assert.ok(presetRows.length > 0, 'the standard Agent Preset standing mount must be visible')
assert.ok(presetRows.some((capability) => capability.id === 'tool-bash'), 'standard preset tool rows must be present')
assert.ok(response.capabilities.some((capability) => capability.id === 'persona' && capability.compositionScope === 'agent-preset'), 'preset-only rows must be attributed to the preset plane')
for (const row of presetRows) {
  assert.equal(row.policy.status, 'locked', `preset row ${row.id} must never be manageable`)
  assert.equal(row.policy.reason, 'agent-preset', `preset row ${row.id} lock reason`)
  assert.equal(row.mutationEligibility.status, 'ineligible', `preset row ${row.id} must be ineligible`)
  assert.ok(row.mutationEligibility.reasons.includes('agent_preset_scope'), `preset row ${row.id} reason`)
  // v1 state/status domains stay closed; the additive profileApplicability
  // field carries the real "not governed by the Web profile" semantics.
  assert.equal(row.configuration.profileOverride.state, 'unavailable', `preset row ${row.id} conservative override`)
  assert.equal(row.configuration.profilePersistence.status, 'unwritable', `preset row ${row.id} conservative persistence`)
  assert.equal(row.configuration.profileApplicability, 'not-applicable', `preset row ${row.id} applicability`)
  assert.ok(row.scopeId.startsWith('include:agent-presets:'), `preset row ${row.id} scopeId ${row.scopeId}`)
}

for (const id of MANAGEABLE_IDS) {
  const leaf = response.capabilities.find((capability) => capability.id === id)!
  assert.equal(leaf.compositionScope, 'host', `${id} must be a Host row`)
  assert.equal(leaf.mutationEligibility.status, 'eligible', `${id} must stay eligible; reasons=${leaf.mutationEligibility.reasons.join(',')}`)
}

console.log(JSON.stringify({
  status: 'passed',
  compatibility: response.compatibility.status,
  runtimeIdentity: response.compatibility.runtimeIdentity.status,
  totalEntries: response.inventory.totalEntries,
  hostEntries: response.capabilities.filter((capability) => capability.compositionScope === 'host').length,
  agentPresetEntries: presetRows.length,
  manageableLeavesEligible: MANAGEABLE_IDS.length,
  findings: findings.map((finding) => finding.code),
}, null, 2))

// The booted tree owns process lifetime (web server, timers, HMR watch); the
// smoke is a one-shot assertion, so exit explicitly.
process.exit(0)

/** Map a Cordis fiber state to the plugin's phase vocabulary. */
function fiberPhase(state: number | undefined): string | null {
  if (state === undefined) return null
  const phases: Record<number, string | null> = { 0: 'pending', 1: 'loading', 2: 'active', 3: 'failed', 4: null, 5: 'unloading' }
  return phases[state] ?? null
}

/** Project a loader inject option exactly as the host route does. */
function declaredInjectEvidence(options: { inject?: unknown }): readonly string[] | null {
  const inject = options.inject
  if (inject === undefined) return null
  if (Array.isArray(inject) && inject.every((value) => typeof value === 'string')) return inject as readonly string[]
  return null
}
