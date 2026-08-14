import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const directory = mkdtempSync(join(tmpdir(), 'dsh-builtin-toggles-pack-'))
try {
  execFileSync('npm', ['pack', '--pack-destination', directory], { stdio: 'inherit' })
  const tarball = join(directory, readdirSync(directory).find((name) => name.endsWith('.tgz')) ?? '')
  if (!tarball.endsWith('.tgz')) throw new Error('npm pack produced no tarball')
  const files = execFileSync('tar', ['-tzf', tarball], { encoding: 'utf8' }).trim().split('\n')
  for (const required of ['package/package.json', 'package/lib/index.js', 'package/lib/index.d.ts', 'package/lib/client.js', 'package/cordis.patch.yml']) {
    if (!files.includes(required)) throw new Error(`tarball missing ${required}`)
  }
  const client = execFileSync('tar', ['-xOf', tarball, 'package/lib/client.js'], { encoding: 'utf8' })
  if (!client.startsWith('window.__ModuleLoader__.load({ id: "dsh-builtin-toggles", factory: (require) => {')) {
    throw new Error('client bundle does not satisfy the ModuleLoader contract')
  }
  const install = join(directory, 'install')
  execFileSync('npm', ['install', '--ignore-scripts', '--no-package-lock', tarball], { cwd: directory, stdio: 'inherit' })
  execFileSync(process.execPath, ['--input-type=module', '--eval', "import('dsh-builtin-toggles').then(() => console.log('root export import ok'))"], { cwd: directory, stdio: 'inherit' })
  console.log(JSON.stringify({ status: 'package-validated', files: files.length, install }))
} finally {
  rmSync(directory, { recursive: true, force: true })
}
