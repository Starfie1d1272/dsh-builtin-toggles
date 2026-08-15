import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, realpathSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import vm from 'node:vm'

const directory = mkdtempSync(join(tmpdir(), 'dsh-builtin-toggles-pack-'))
try {
  execFileSync('npm', ['pack', '--pack-destination', directory], { stdio: 'inherit' })
  const tarball = join(directory, readdirSync(directory).find((name) => name.endsWith('.tgz')) ?? '')
  if (!tarball.endsWith('.tgz')) throw new Error('npm pack produced no tarball')
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
  for (const required of [
    'package/package.json', 'package/lib/index.js', 'package/lib/index.d.ts', 'package/lib/client.js', 'package/cordis.patch.yml',
    'package/README.md', 'package/README.en.md', 'package/CONTRIBUTING.md', 'package/CONTRIBUTING.zh-CN.md', 'package/COMPATIBILITY.md', 'package/CHANGELOG.md', 'package/SECURITY.md', 'package/docs/inspection-api.md',
  ]) {
    if (!files.includes(required)) throw new Error(`tarball missing ${required}`)
  }
  const client = execFileSync('tar', ['-xOf', tarball, 'package/lib/client.js'], { encoding: 'utf8' })
  const registrations = []
  vm.runInNewContext(client, {
    window: { __ModuleLoader__: { load: (registration) => registrations.push(registration) } },
  }, { filename: 'lib/client.js', timeout: 1_000 })
  if (registrations.length !== 1 || registrations[0]?.id !== 'dsh-builtin-toggles' || typeof registrations[0]?.factory !== 'function') {
    throw new Error('client bundle does not register the expected ModuleLoader factory')
  }
  const install = join(directory, 'install')
  execFileSync('npm', ['install', '--ignore-scripts', '--no-package-lock', tarball], { cwd: directory, stdio: 'inherit' })
  const require = createRequire(join(directory, 'package.json'))
  const installedNodeModules = realpathSync(join(directory, 'node_modules'))
  for (const exportPath of ['dsh-builtin-toggles', 'dsh-builtin-toggles/client', 'dsh-builtin-toggles/cordis.patch.yml', 'dsh-builtin-toggles/package.json']) {
    const resolved = realpathSync(require.resolve(exportPath))
    if (!resolved.startsWith(installedNodeModules)) throw new Error(`export ${exportPath} did not resolve from the installed tarball`)
  }
  execFileSync(process.execPath, ['--input-type=module', '--eval', "import('dsh-builtin-toggles').then(() => console.log('root export import ok'))"], { cwd: directory, stdio: 'inherit' })
  console.log(JSON.stringify({ status: 'package-validated', files: files.length, install }))
} finally {
  rmSync(directory, { recursive: true, force: true })
}
