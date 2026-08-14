/**
 * Minimal, conservative textual writer for the profile patch layer
 * (`$DSH_HOME/profiles/<profile>/cordis.patch.yml`).
 *
 * The official config file may carry `!!js` expressions, comments, and user
 * structure we do not understand, so a generic parse → stringify round trip
 * is forbidden. This writer only:
 *
 * - recognizes TOP-LEVEL `- id: <exact id>` rows (column 0) as the override
 *   target; an id inside a nested `insert:` block is never edited in place;
 * - adds, replaces, or removes only that row's OWN literal `disabled:` field
 *   (at the row's observed child indentation); when restore leaves a minimal
 *   row empty, it removes that row while retaining a valid empty sequence;
 * - leaves `config`, `name`, other ids, comments, `!!js` and the original
 *   line endings untouched;
 * - appends a minimal name-less `- id: <id>` / `  disabled: …` override when
 *   the row does not exist. Official patch semantics merge an override's keys
 *   onto the composed entry by id (a name-less row skips the Loader's
 *   name-mismatch check), so this also correctly targets a row this same
 *   file inserted earlier — the nested block stays byte-identical;
 * - writes through a sibling temp file + atomic rename, with an optimistic
 *   concurrency re-read immediately before the rename: an external edit
 *   since our first read refuses the write instead of being overwritten.
 *
 * Line endings: the EOL style is detected from the file's first newline and
 * used for inserted lines; existing lines are never rewritten.
 *
 * The read → render → verify → commit cycle runs under the official
 * `@deepseek-ai/dsh-atomic-write` cross-process writer lock
 * (`withFileLock`), and the commit itself is that package's
 * `writeFileAtomic` (random-suffix sibling + rename). The optimistic
 * concurrency re-read happens INSIDE the lock, immediately before the
 * commit: an external edit since our locked read refuses the write instead
 * of being overwritten, and two of our own writers can never interleave.
 */

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { withFileLock, writeFileAtomic } from '@deepseek-ai/dsh-atomic-write'

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

export type ProfileOverrideState = 'inherited' | 'explicitly-enabled' | 'explicitly-disabled'

export interface ProfileOverrideInspection {
  state: ProfileOverrideState | 'unavailable'
  /** An unavailable state is read-only information, never an authorization. */
  reason?: 'duplicate_top_level_row' | 'duplicate_disabled_field' | 'non_literal_disabled' | 'profile_unavailable'
}

/**
 * Whether the textual writer can conservatively attempt this entry. This is
 * deliberately distinct from `ProfileOverrideInspection`: a missing patch is
 * semantically inherited, but is not a file we are permitted to create.
 */
export type ProfileMutationPreflight =
  | { status: 'writable' }
  | {
    status: 'unwritable'
    reason: 'profile_patch_missing' | 'profile_patch_unreadable' | 'duplicate_top_level_row' | 'duplicate_disabled_field' | 'non_literal_disabled'
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

interface TargetRow {
  start: number
  end: number
  indent: string
  disabledIndex: number
  disabledValue: boolean | null
  disabledSuffix: string
  rowInlineComment: string
}

function targetRows(lines: readonly string[], id: string): number[] {
  const rows: number[] = []
  for (let i = 0; i < lines.length; i += 1) if (topLevelRowId(lines[i]!) === id) rows.push(i)
  return rows
}

/** Locate one exact top-level override row without ever traversing `insert:`. */
function locateTargetRow(lines: readonly string[], id: string): TargetRow | null {
  const rows = targetRows(lines, id)
  if (rows.length > 1) throw new PatchError(`builtin-toggles: duplicate top-level override rows for ${id}; refusing to guess`)
  const start = rows[0]
  if (start === undefined) return null
  let end = lines.length
  for (let i = start + 1; i < lines.length; i += 1) {
    if (isTopLevelItem(lines[i]!) || isTopLevelContent(lines[i]!)) {
      end = i
      break
    }
  }
  let childIndent = 2
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i]!
    const trimmed = line.trimStart()
    if (trimmed.length === 0 || trimmed.startsWith('#')) continue
    childIndent = line.length - trimmed.length
    break
  }
  const indent = ' '.repeat(childIndent)
  const rowInlineComment = /^-\s+id:\s*\S+(\s+#.*)?\s*$/.exec(lines[start]!)?.[1] ?? ''
  const prefix = new RegExp(`^${indent}disabled:`)
  let disabledIndex = -1
  let disabledValue: boolean | null = null
  let disabledSuffix = ''
  for (let i = start + 1; i < end; i += 1) {
    const line = lines[i]!
    if (!prefix.test(line)) continue
    if (disabledIndex !== -1) throw new PatchError(`builtin-toggles: duplicate disabled fields for ${id}; refusing to guess`)
    disabledIndex = i
    const literal = new RegExp(`^${indent}disabled:\\s*(true|false)(\\s*(?:#.*)?)?$`).exec(line)
    if (literal === null) throw new PatchError(`builtin-toggles: ${id} has a non-literal disabled override; refusing to rewrite it`)
    disabledValue = literal[1] === 'true'
    disabledSuffix = literal[2] ?? ''
  }
  return { start, end, indent, disabledIndex, disabledValue, disabledSuffix, rowInlineComment }
}

/** Read only the current profile-layer override; no YAML reserialization. */
export function inspectProfileOverride(content: string, id: string): ProfileOverrideInspection {
  const lines = content.length === 0 ? [] : content.split(/\r?\n/)
  try {
    const row = locateTargetRow(lines, id)
    if (row === null || row.disabledIndex === -1) return { state: 'inherited' }
    return { state: row.disabledValue ? 'explicitly-disabled' : 'explicitly-enabled' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    return {
      state: 'unavailable',
      reason: message.includes('duplicate top-level')
        ? 'duplicate_top_level_row'
        : message.includes('duplicate disabled')
          ? 'duplicate_disabled_field'
          : 'non_literal_disabled',
    }
  }
}

/**
 * Read-only preflight for the known writer rejection paths. It intentionally
 * does not lock or commit anything: `applyProfilePatch()` still takes the
 * writer lock and repeats all read/render/concurrency checks at commit time.
 */
export function preflightProfileMutation(file: string, id: string): ProfileMutationPreflight {
  let content: string
  try {
    content = readFileSync(file, 'utf8')
    statSync(file)
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined
    return { status: 'unwritable', reason: code === 'ENOENT' ? 'profile_patch_missing' : 'profile_patch_unreadable' }
  }
  try {
    locateTargetRow(content.length === 0 ? [] : content.split(/\r?\n/), id)
    return { status: 'writable' }
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    if (message.includes('duplicate top-level')) return { status: 'unwritable', reason: 'duplicate_top_level_row' }
    if (message.includes('duplicate disabled')) return { status: 'unwritable', reason: 'duplicate_disabled_field' }
    return { status: 'unwritable', reason: 'non_literal_disabled' }
  }
}

/**
 * Render `content` with the top-level override row for `id` set to
 * `disabled`. Pure: no filesystem access, no parsing of unknown structure.
 */
export function renderDisabledPatch(content: string, id: string, disabled: boolean): RenderResult {
  const eol = detectEol(content)
  const rawLines = content.length === 0 ? [] : content.split(/\r?\n/)
  const lines: string[] = [...rawLines]

  const value = String(disabled)
  const defaultChildIndent = 2
  const target = locateTargetRow(lines, id)

  if (target !== null) {
    // ── row exists: operate on its own subtree only ──────────────────────────
    if (target.disabledIndex !== -1) {
      if (target.disabledValue === disabled) return { content, changed: false, createdRow: false }
      // Preserve an inline explanation exactly; generic YAML output would not.
      lines[target.disabledIndex] = `${target.indent}disabled: ${value}${target.disabledSuffix}`
    } else {
      lines.splice(target.end, 0, `${target.indent}disabled: ${value}`)
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

/** Remove only this row's literal top-level `disabled` override. */
export function renderRestoreInheritance(content: string, id: string): RenderResult {
  const eol = detectEol(content)
  const lines = content.length === 0 ? [] : content.split(/\r?\n/)
  const target = locateTargetRow(lines, id)
  if (target === null || target.disabledIndex === -1) return { content, changed: false, createdRow: false }

  const hasOtherContent = lines.slice(target.start + 1, target.end).some((line, index) => {
    const absoluteIndex = target.start + 1 + index
    return absoluteIndex !== target.disabledIndex && line.trim() !== '' && !line.trimStart().startsWith('#')
  })
  const hasComments = lines.slice(target.start + 1, target.end).some((line, index) => {
    const absoluteIndex = target.start + 1 + index
    return absoluteIndex !== target.disabledIndex && line.trimStart().startsWith('#')
  }) || target.disabledSuffix.trim().length > 0 || target.rowInlineComment.length > 0

  if (!hasOtherContent && !hasComments) {
    lines.splice(target.disabledIndex, 1)
    lines.splice(target.start, 1)
    // An empty YAML document is not the profile's canonical empty sequence.
    // Keep the file consumable while still deleting the override row itself.
    if (lines.every((line) => line.trim() === '' || line.trimStart().startsWith('#'))) {
      const trailing = lines.length > 0 && lines[lines.length - 1] === ''
      lines.splice(trailing ? lines.length - 1 : lines.length, 0, '[]')
    }
  } else if (!hasOtherContent) {
    // A minimal override may still carry an inline id comment. Once the row
    // itself is removed, retain that comment as a standalone YAML comment.
    lines.splice(target.disabledIndex, 1)
    lines.splice(target.start, 1)
    if (target.rowInlineComment.length > 0) lines.splice(target.start, 0, target.rowInlineComment.trimStart())
    if (lines.every((line) => line.trim() === '' || line.trimStart().startsWith('#'))) {
      const trailing = lines.length > 0 && lines[lines.length - 1] === ''
      lines.splice(trailing ? lines.length - 1 : lines.length, 0, '[]')
    }
  } else if (target.disabledSuffix.trim().length > 0) {
    // Retain an inline comment as a comment line instead of discarding it.
    lines[target.disabledIndex] = `${target.indent}${target.disabledSuffix.trimStart()}`
  } else {
    lines.splice(target.disabledIndex, 1)
  }
  return { content: lines.join(eol), changed: true, createdRow: false }
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

export interface ApplyDeps {
  /** Read the current file content (called under the lock). */
  read: (file: string) => string
  /** Atomically replace the file content, preserving the stated mode. */
  writeAtomic: (file: string, content: string, mode: number) => Promise<void>
  /** Hold the cross-process writer lock for `file` around one operation. */
  lock: <T>(file: string, operation: () => Promise<T>) => Promise<T>
}

const realDeps: ApplyDeps = {
  read: (file) => readFileSync(file, 'utf8'),
  writeAtomic: (file, content, mode) => writeFileAtomic(file, content, { mode }),
  lock: withFileLock,
}

/**
 * Persist one `disabled` override under the official writer lock, with
 * optimistic concurrency: lock → read → render → re-read → refuse on
 * mismatch → atomic replace. The re-read happens inside the lock so two of
 * our own writers can never lose each other's committed content, and an
 * external (non-locking) edit since our locked read refuses the write
 * instead of being overwritten.
 * @returns what changed; throws ConcurrentEditError / PatchError / fs errors.
 */
export async function applyDisabledOverride(
  file: string,
  id: string,
  disabled: boolean,
  deps: ApplyDeps = realDeps,
): Promise<{ changed: boolean; createdRow: boolean }> {
  return applyProfilePatch(file, (content) => renderDisabledPatch(content, id, disabled), deps)
}

/** Restore Loader inheritance by deleting this profile row's `disabled` field. */
export async function restoreDisabledInheritance(
  file: string,
  id: string,
  deps: ApplyDeps = realDeps,
): Promise<{ changed: boolean; createdRow: boolean }> {
  return applyProfilePatch(file, (content) => renderRestoreInheritance(content, id), deps)
}

async function applyProfilePatch(
  file: string,
  render: (content: string) => RenderResult,
  deps: ApplyDeps,
): Promise<{ changed: boolean; createdRow: boolean }> {
  if (!existsSync(file)) {
    throw new PatchError(`builtin-toggles: profile patch missing: ${file}; refusing to create it implicitly`)
  }
  // The lock's sibling (<file>.lock) lives next to the target, so the parent
  // directory must exist — it does (the file exists). Preserve the existing
  // file mode through the atomic replace.
  const mode = statSync(file).mode & 0o777
  return deps.lock(file, async () => {
    const original = deps.read(file)
    const rendered = render(original)
    if (!rendered.changed) return { changed: false, createdRow: false }
    // Optimistic concurrency: refuse (not overwrite) an external edit that
    // landed between our locked read and the replace.
    const current = deps.read(file)
    if (current !== original) {
      throw new ConcurrentEditError(file)
    }
    await deps.writeAtomic(file, rendered.content, mode)
    return { changed: true, createdRow: rendered.createdRow }
  })
}
