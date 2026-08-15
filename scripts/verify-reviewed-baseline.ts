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
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REVIEWED_DSH_WEB_BASELINE } from '../src/evidence.ts'
import { MANAGEABLE_IDS } from '../src/policy.ts'

export type ArtifactRow = { id: string; packageName: string; inject: readonly string[] | null }

function scalar(raw: string): string {
  const value = raw.trim().replace(/\s+#.*$/, '')
  if (/^'[^']*'$/.test(value) || /^"[^"\\]*"$/.test(value)) return value.slice(1, -1)
  if (!/^[A-Za-z0-9][A-Za-z0-9._/@+-]*$/.test(value)) throw new Error(`unsupported artifact scalar: ${raw}`)
  return value
}

/** Minimal reader for the published patch's regular `insert` item layout. */
export function patchRows(file: string): ArtifactRow[] {
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

/** `null` means no declaration; it is deliberately not the same as `[]`. */
export function sameDeclaredInject(left: readonly string[] | null, right: readonly string[] | null): boolean {
  if (left === null || right === null) return left === right
  const canonical = (value: readonly string[]) => [...new Set(value)].sort()
  const expected = canonical(left)
  const observed = canonical(right)
  return expected.length === observed.length && expected.every((value, index) => value === observed[index])
}

export interface BaselineDifference {
  duplicateIds: readonly string[]
  missingReviewedIds: readonly string[]
  unexpectedIds: readonly string[]
  packageMismatches: readonly { id: string; expected: string; observed: string }[]
  injectMismatches: readonly { id: string; expected: readonly string[] | null; observed: readonly string[] | null }[]
}

export function compareReviewedBaseline(rows: readonly ArtifactRow[]): BaselineDifference {
  const artifacts = new Map<string, ArtifactRow>()
  const duplicateIds: string[] = []
  for (const row of rows) {
    if (artifacts.has(row.id)) duplicateIds.push(row.id)
    else artifacts.set(row.id, row)
  }
  const reviewedIds = new Set<string>()
  const missingReviewedIds: string[] = []
  const packageMismatches: { id: string; expected: string; observed: string }[] = []
  const injectMismatches: { id: string; expected: readonly string[] | null; observed: readonly string[] | null }[] = []
  for (const reviewed of REVIEWED_DSH_WEB_BASELINE) {
    if (reviewedIds.has(reviewed.id)) throw new Error(`baseline duplicate id: ${reviewed.id}`)
    reviewedIds.add(reviewed.id)
    if (reviewed.expectedPackageName === null) throw new Error(`baseline package unknown: ${reviewed.id}`)
    if (reviewed.reviewedReference === null) throw new Error(`baseline provenance missing: ${reviewed.id}`)
    const observed = artifacts.get(reviewed.id)
    if (observed === undefined) { missingReviewedIds.push(reviewed.id); continue }
    if (observed.packageName !== reviewed.expectedPackageName) {
      packageMismatches.push({ id: reviewed.id, expected: reviewed.expectedPackageName, observed: observed.packageName })
    }
    const expected = reviewed.serviceEvidence.find((evidence) => evidence.kind === 'declared-inject')?.expectedServices ?? null
    if (!sameDeclaredInject(observed.inject, expected)) injectMismatches.push({ id: reviewed.id, expected, observed: observed.inject })
  }
  return {
    duplicateIds,
    missingReviewedIds,
    unexpectedIds: [...artifacts.keys()].filter((id) => !reviewedIds.has(id)).sort(),
    packageMismatches,
    injectMismatches,
  }
}

function hasDifferences(difference: BaselineDifference): boolean {
  return Object.values(difference).some((value) => value.length > 0)
}

function main(): void {
  const args = process.argv.slice(2)
  const reportOnly = args[0] === '--report'
  if (reportOnly) args.shift()
  const [baseFile, webFile] = args
  if (baseFile === undefined || webFile === undefined || args.length !== 2) throw new Error('expected base and web cordis.patch.yml paths')
  const difference = compareReviewedBaseline([...patchRows(baseFile), ...patchRows(webFile)])
  if (!reportOnly) {
    assert(!hasDifferences(difference), `reviewed roster/package/inject differences: ${JSON.stringify(difference)}`)
    for (const id of MANAGEABLE_IDS) {
      const reviewed = REVIEWED_DSH_WEB_BASELINE.find((entry) => entry.id === id)
      assert(reviewed?.expectedPackageName && reviewed.reviewedReference && reviewed.leafReview === 'reviewed-safe-ui-leaf', `manageable id lacks reviewed evidence: ${id}`)
    }
  }
  console.log(JSON.stringify({
    status: hasDifferences(difference) ? 'drifted' : 'verified-machine-checks',
    reviewedEntries: REVIEWED_DSH_WEB_BASELINE.length,
    manageableEntries: MANAGEABLE_IDS.length,
    difference,
  }))
}

if (process.argv[1] !== undefined && fileURLToPath(import.meta.url) === resolve(process.argv[1])) main()
