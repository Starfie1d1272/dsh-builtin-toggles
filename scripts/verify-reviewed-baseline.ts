/**
 * Verify the reviewable, machine-checkable portion of the rc.6 evidence.
 *
 * Usage:
 *   pnpm verify:baseline path/to/dsh-base/cordis.patch.yml path/to/dsh-web-app/cordis.patch.yml
 *
 * This intentionally does not claim to prove provides/consumer absence. That
 * safe-leaf conclusion remains a documented human architecture review.
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { REVIEWED_DSH_WEB_BASELINE } from '../src/evidence.ts'
import { MANAGEABLE_IDS } from '../src/policy.ts'

type ArtifactRow = { id: string; packageName: string; inject: readonly string[] | null }

function scalar(raw: string): string {
  const value = raw.trim().replace(/\s+#.*$/, '')
  if (/^'[^']*'$/.test(value) || /^"[^"\\]*"$/.test(value)) return value.slice(1, -1)
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@+-]*$/.test(value)) throw new Error(`unsupported artifact scalar: ${raw}`)
  return value
}

/** Minimal reader for the published patch's regular `insert` item layout. */
function patchRows(file: string): ArtifactRow[] {
  const lines = readFileSync(file, 'utf8').split(/\r?\n/)
  const rows: ArtifactRow[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const start = /^(\s*)-\s+id:\s*(.+)$/.exec(lines[index]!)
    if (start === null) continue
    const indent = start[1]!.length
    let end = lines.length
    for (let next = index + 1; next < lines.length; next += 1) {
      if (new RegExp(`^ {${indent}}-\\s`).test(lines[next]!)) { end = next; break }
    }
    let packageName: string | null = null
    let inject: readonly string[] | null = null
    for (let line = index + 1; line < end; line += 1) {
      const name = new RegExp(`^ {${indent + 2}}name:\\s*(.+)$`).exec(lines[line]!)
      if (name !== null) packageName = scalar(name[1]!)
      const prefix = `${' '.repeat(indent + 2)}inject:`
      if (lines[line]!.startsWith(prefix)) {
        const raw = lines[line]!.slice(prefix.length).trim()
        const inline = /^\[([^\]]*)\]$/.exec(raw)
        if (inline === null) throw new Error(`unsupported artifact inject: ${lines[line]}`)
        inject = inline[1]!.trim() === '' ? [] : inline[1]!.split(',').map((entry) => scalar(entry))
      }
    }
    if (packageName !== null) rows.push({ id: scalar(start[2]!), packageName, inject })
  }
  return rows
}

const [baseFile, webFile] = process.argv.slice(2)
if (baseFile === undefined || webFile === undefined) throw new Error('expected base and web cordis.patch.yml paths')
const artifacts = new Map<string, ArtifactRow>()
for (const row of [...patchRows(baseFile), ...patchRows(webFile)]) {
  assert(!artifacts.has(row.id), `published patch duplicate id: ${row.id}`)
  artifacts.set(row.id, row)
}
const reviewedIds = new Set<string>()
for (const reviewed of REVIEWED_DSH_WEB_BASELINE) {
  assert(!reviewedIds.has(reviewed.id), `baseline duplicate id: ${reviewed.id}`)
  reviewedIds.add(reviewed.id)
  assert(reviewed.expectedPackageName !== null, `baseline package unknown: ${reviewed.id}`)
  assert(reviewed.reviewedReference !== null, `baseline provenance missing: ${reviewed.id}`)
  const observed = artifacts.get(reviewed.id)
  assert(observed !== undefined, `reviewed id absent from published patch: ${reviewed.id}`)
  assert.equal(observed.packageName, reviewed.expectedPackageName, `package mismatch: ${reviewed.id}`)
  const expectedInject = reviewed.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')?.expectedServices ?? null
  assert.deepEqual([...(observed.inject ?? [])].sort(), [...(expectedInject ?? [])].sort(), `inject mismatch: ${reviewed.id}`)
}
assert.equal(artifacts.size, reviewedIds.size, 'reviewed roster differs from published patches')
for (const id of MANAGEABLE_IDS) {
  const reviewed = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === id)
  assert(reviewed?.expectedPackageName && reviewed.reviewedReference && reviewed.leafReview === 'reviewed-safe-ui-leaf', `manageable id lacks reviewed evidence: ${id}`)
}
console.log(JSON.stringify({ status: 'verified-machine-checks', reviewedEntries: reviewedIds.size, manageableEntries: MANAGEABLE_IDS.length }))
