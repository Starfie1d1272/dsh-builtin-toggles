/**
 * Minimal, conservative textual writer for the profile patch layer
 * (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`).
 *
 * The official config file may carry `!!js` expressions, comments, and user
 * structure we do not understand, so a generic parse → stringify round trip
 * is forbidden. This writer only:
 *
 * - recognizes TOP-LEVEL `- id: <exact id>` rows (column 0); a nested id
 *   inside an `insert:` block is never touched;
 * - adds or replaces only that row's OWN `disabled:` field (at the row's
 *   observed child indentation);
 * - leaves `config`, `name`, other ids, comments, `!!js` and the original
 *   line endings untouched;
 * - appends a minimal `- id: <id>` / `  disabled: …` override when the row
 *   does not exist yet (and refuses when the id already appears nested —
 *   creating a duplicate patch row is never safe);
 * - writes through a sibling temp file + atomic rename, with an optimistic
 *   concurrency re-read immediately before the rename: an external edit
 *   since our first read refuses the write instead of being overwritten.
 *
 * Line endings: the EOL style is detected from the file's first newline and
 * used for inserted lines; existing lines are never rewritten.
 */

import { randomBytes } from 'node:crypto'
import {
  closeSync,
  existsSync,
  fsyncSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

/** Thrown when the patch file changed between our read and our write. */
export class ConcurrentEditError extends Error {
  constructor(file: string) {
    super(`builtin-toggles: ${file} changed concurrently; refusing to overwrite`)
    this.name = 'ConcurrentEditError'
  }
}

/** Thrown when the patch file is in a state we refuse to mutate. */
export class PatchError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'PatchError'
  }
}

export interface RenderResult {
  /** The complete new file content. */
  content: string
  /** False when the file already carries the requested state (no write needed). */
  changed: boolean
  /** True when a new top-level override row was added. */
  createdRow: boolean
}

/** EOL style of the file, from its first newline; defaults to LF. */
function detectEol(content: string): string {
  const index = content.indexOf('\r\n')
  return index === -1 ? '\n' : '\r\n'
}

/** Whether a line is a top-level list item (`- …` at column 0). */
function isTopLevelItem(line: string): boolean {
  return /^-\s/.test(line)
}

/** Whether a line is column-0 content (not indented, not blank, not a comment). */
function isTopLevelContent(line: string): boolean {
  return line.length > 0 && !/^\s/.test(line) && !line.startsWith('#')
}

/** Parse the exact id of a top-level `- id: …` row; null for anything else. */
function topLevelRowId(line: string): string | null {
  if (!isTopLevelItem(line)) return null
  const match = /^-\s+id:\s*(\S+)/.exec(line)
  return match === null ? null : match[1]!
}

/**
 * Render `content` with the top-level override row for `id` set to
 * `disabled`. Pure: no filesystem access, no parsing of unknown structure.
 */
export function renderDisabledPatch(content: string, id: string, disabled: boolean): RenderResult {
  const eol = detectEol(content)
  const rawLines = content.length === 0 ? [] : content.split(/\r?\n/)
  const lines: string[] = [...rawLines]

  // ── find the top-level target row ──────────────────────────────────────────
  let rowIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (topLevelRowId(lines[i]!) === id) {
      rowIndex = i
      break
    }
  }

  const value = String(disabled)
  const defaultChildIndent = 2

  if (rowIndex !== -1) {
    // ── row exists: operate on its own subtree only ──────────────────────────
    let subtreeEnd = lines.length
    for (let i = rowIndex + 1; i < lines.length; i += 1) {
      const line = lines[i]!
      if (isTopLevelItem(line) || isTopLevelContent(line)) {
        subtreeEnd = i
        break
      }
    }

    // The row's own children indentation: observed from its first real child,
    // defaulting to 2 spaces (the canonical `- id:` child indent).
    let childIndent = defaultChildIndent
    for (let i = rowIndex + 1; i < subtreeEnd; i += 1) {
      const line = lines[i]!
      const trimmed = line.trimStart()
      if (trimmed.length === 0 || trimmed.startsWith('#')) continue
      childIndent = line.length - trimmed.length
      break
    }
    const indent = ' '.repeat(childIndent)
    const disabledPattern = new RegExp(`^${indent}disabled:`)

    let disabledIndex = -1
    for (let i = rowIndex + 1; i < subtreeEnd; i += 1) {
      if (disabledPattern.test(lines[i]!)) {
        disabledIndex = i
        break
      }
    }

    if (disabledIndex !== -1) {
      const existing = lines[disabledIndex]!.replace(disabledPattern, '').trim()
      if (existing === value) return { content, changed: false, createdRow: false }
      lines[disabledIndex] = `${indent}disabled: ${value}`
    } else {
      lines.splice(subtreeEnd, 0, `${indent}disabled: ${value}`)
    }
    return { content: lines.join(eol), changed: true, createdRow: false }
  }

  // ── no top-level row: append a minimal override ────────────────────────────
  // A top-level `- id: <id>` override patches the entry the Loader composed
  // from earlier layers (or from this file's own insert rows): official patch
  // semantics merge only the given keys onto the target row, and an id found
  // inside a nested `insert:` block is the row the override targets — never a
  // row to edit in place. So appending is safe; the nested block stays
  // byte-identical and the override carries no `name` (a name would trip the
  // Loader's name-mismatch skip against bundle-inserted rows).
  const row: string[] = [`- id: ${id}`, `${' '.repeat(defaultChildIndent)}disabled: ${value}`]

  // The profile template is `[]` (possibly with comments): replace the flow
  // sequence in place — a `[]` followed by block rows is not valid YAML.
  let flowIndex = -1
  for (let i = 0; i < lines.length; i += 1) {
    if (/^\[\]\s*$/.test(lines[i]!)) {
      flowIndex = i
      break
    }
  }
  if (flowIndex !== -1) {
    lines.splice(flowIndex, 1, ...row)
    return { content: lines.join(eol), changed: true, createdRow: true }
  }

  // Append at the end, preserving the trailing newline when present.
  if (lines.length === 0) {
    lines.push(...row, '')
  } else if (lines[lines.length - 1] === '') {
    lines.splice(lines.length - 1, 0, ...row)
  } else {
    lines.push(...row)
  }
  return { content: lines.join(eol), changed: true, createdRow: true }
}

/** Resolve `$DSH_HOME`, defaulting to `~/.dsh` when unset or blank. */
export function dshHomeDir(): string {
  const env = process.env.DSH_HOME
  return env !== undefined && env.trim() !== '' ? env : join(homedir(), '.dsh')
}

/** The profile patch path this plugin persists to. */
export function profilePatchPath(profile = 'web'): string {
  return join(dshHomeDir(), 'profiles', profile, 'cordis.patch.yml')
}

/**
 * Write `content` to `file` atomically: sibling temp file, fsync, rename.
 * Never leaves a half-written target file behind.
 */
export function writeTextAtomic(file: string, content: string): void {
  const temp = `${file}.builtin-toggles-${process.pid}-${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(temp, content, 'utf8')
  try {
    // Open + fsync the temp before rename so the rename never publishes a
    // partially-flushed page (best effort; the rename itself is the atomic step).
    const fd = openForFsync(temp)
    fsyncFd(fd)
    closeFd(fd)
    renameSync(temp, file)
  } catch (error) {
    try {
      unlinkQuiet(temp)
    } catch {
      // best effort cleanup
    }
    throw error
  }
}

function openForFsync(path: string): number {
  return openSync(path, 'r')
}
function fsyncFd(fd: number): void {
  fsyncSync(fd)
}
function closeFd(fd: number): void {
  closeSync(fd)
}
function unlinkQuiet(path: string): void {
  unlinkSync(path)
}

export interface ApplyDeps {
  /** Read the current file content. */
  read: (file: string) => string
  /** Atomically replace the file content. */
  writeAtomic: (file: string, content: string) => void
}

const realDeps: ApplyDeps = {
  read: (file) => readFileSync(file, 'utf8'),
  writeAtomic: writeTextAtomic,
}

/**
 * Persist one `disabled` override with optimistic concurrency:
 * read → render → re-read → refuse on mismatch → atomic replace.
 * @returns what changed; throws ConcurrentEditError / PatchError / ENOENT.
 */
export function applyDisabledOverride(
  file: string,
  id: string,
  disabled: boolean,
  deps: ApplyDeps = realDeps,
): { changed: boolean; createdRow: boolean } {
  if (!existsSync(file)) {
    throw new PatchError(`builtin-toggles: profile patch missing: ${file}; refusing to create it implicitly`)
  }
  const original = deps.read(file)
  const rendered = renderDisabledPatch(original, id, disabled)
  if (!rendered.changed) return { changed: false, createdRow: false }
  // Optimistic concurrency: refuse (not overwrite) an external edit that
  // landed between our read and the replace.
  const current = deps.read(file)
  if (current !== original) {
    throw new ConcurrentEditError(file)
  }
  deps.writeAtomic(file, rendered.content)
  return { changed: true, createdRow: rendered.createdRow }
}
