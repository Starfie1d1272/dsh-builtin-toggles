/**
 * Profile patch writer tests: textual, conservative, atomic.
 * The profile patch may contain comments, `!!js` expressions and structure
 * we do not understand — the writer must preserve all of it.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  applyDisabledOverride,
  ConcurrentEditError,
  inspectProfileOverride,
  inspectProfileSnapshot,
  PatchError,
  preflightProfileMutation,
  renderRestoreInheritance,
  restoreDisabledInheritance,
  renderDisabledPatch,
  type ApplyDeps,
} from '../src/profile-patch.ts'

const TEMPLATE = `# Your patch layer for this dsh profile, applied after every bundle layer:
# a top-level YAML array of loader patch entries (id-targeted config
# overrides, disables, and insert lists; \`!!js\` expressions allowed).
[]
`

describe('renderDisabledPatch', () => {
  it('1. empty `[]` template → replaces the flow sequence with a minimal override, comments kept', () => {
    const result = renderDisabledPatch(TEMPLATE, 'ui-goal', true)
    assert.equal(result.changed, true)
    assert.equal(result.createdRow, true)
    assert.ok(result.content.startsWith('# Your patch layer'))
    assert.ok(result.content.includes('\n- id: ui-goal\n  disabled: true\n'))
    assert.ok(!result.content.includes('[]'))
  })

  it('2. existing other top-level rows → appends the new override at the end, others untouched', () => {
    const input = '# comment\n- id: ui-jobs\n  disabled: true\n- id: ui-goal-extra\n  disabled: false\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.createdRow, true)
    assert.equal(result.content, '# comment\n- id: ui-jobs\n  disabled: true\n- id: ui-goal-extra\n  disabled: false\n- id: ui-goal\n  disabled: true\n')
  })

  it('3. target row exists without disabled → adds the field to that row only', () => {
    const input = '- id: ui-goal\n  config:\n    something: 1\n- id: ui-jobs\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.createdRow, false)
    // inserted at the end of the target row's own subtree; config untouched
    assert.equal(result.content, '- id: ui-goal\n  config:\n    something: 1\n  disabled: true\n- id: ui-jobs\n')
  })

  it('4. disabled: true → false replaces the value', () => {
    const input = '- id: ui-goal\n  disabled: true\n'
    const result = renderDisabledPatch(input, 'ui-goal', false)
    assert.equal(result.content, '- id: ui-goal\n  disabled: false\n')
  })

  it('5. disabled: false → true replaces the value', () => {
    const input = '- id: ui-goal\n  disabled: false\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.content, '- id: ui-goal\n  disabled: true\n')
  })

  it('same value → no-op (changed=false, identical content)', () => {
    const input = '- id: ui-goal\n  disabled: true\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.changed, false)
    assert.equal(result.content, input)
  })

  it('6. ui-goal must not match ui-goal-extra (exact id matching, both directions)', () => {
    const input = '- id: ui-goal-extra\n  disabled: false\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.createdRow, true)
    // appends a NEW row; the ui-goal-extra row stays byte-identical
    assert.equal(result.content, '- id: ui-goal-extra\n  disabled: false\n- id: ui-goal\n  disabled: true\n')
  })

  it('7. nested insert ids are never touched (override row is appended, block stays byte-identical)', () => {
    const input = '- insert:\n    - id: ui-goal\n      name: \'@deepseek-ai/dsh-client-ui-goal\'\n    - id: ui-jobs\n      name: \'@deepseek-ai/dsh-client-ui-jobs\'\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.createdRow, true)
    assert.equal(result.content, `${input}- id: ui-goal\n  disabled: true\n`)
  })

  it('8. unrelated comments stay verbatim', () => {
    const input = `# top comment
- id: ui-jobs
  # inner comment
  disabled: true
# trailing comment
`
    const result = renderDisabledPatch(input, 'ui-jobs', false)
    assert.equal(result.content, `# top comment
- id: ui-jobs
  # inner comment
  disabled: false
# trailing comment
`)
  })

  it('9. unrelated !!js expressions stay verbatim', () => {
    const input = '- id: web-runtime\n  config:\n    trustedHosts: !!js ctx.webStartup.trustedHosts\n- id: ui-goal\n  disabled: true\n'
    const result = renderDisabledPatch(input, 'ui-goal', false)
    assert.equal(result.content, '- id: web-runtime\n  config:\n    trustedHosts: !!js ctx.webStartup.trustedHosts\n- id: ui-goal\n  disabled: false\n')
  })

  it('10. CRLF files keep CRLF (inserted lines included)', () => {
    const input = '- id: ui-jobs\r\n  disabled: true\r\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.content, '- id: ui-jobs\r\n  disabled: true\r\n- id: ui-goal\r\n  disabled: true\r\n')
  })

  it('existing row with 4-space children indentation is respected', () => {
    const input = '- id: ui-goal\n    disabled: false\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    assert.equal(result.content, '- id: ui-goal\n    disabled: true\n')
  })

  it('empty file → minimal override with trailing newline', () => {
    const result = renderDisabledPatch('', 'ui-goal', true)
    assert.equal(result.content, '- id: ui-goal\n  disabled: true\n')
  })

  it('nested id → override row carries no name (Loader name-mismatch skip would reject one)', () => {
    const input = '- insert:\n    - id: ui-goal\n      name: \'@deepseek-ai/dsh-client-ui-goal\'\n'
    const result = renderDisabledPatch(input, 'ui-goal', true)
    // the appended override row is exactly `- id: ui-goal` + `  disabled: true`, no name
    assert.equal(result.content, `${input}- id: ui-goal\n  disabled: true\n`)
  })

  it('recognizes quoted ids and ids placed after another direct row field without rewriting either spelling', () => {
    const quoted = renderDisabledPatch('- id: "ui-goal" # keep spelling\n  disabled: false\n', 'ui-goal', true)
    assert.equal(quoted.content, '- id: "ui-goal" # keep spelling\n  disabled: true\n')
    const reordered = renderDisabledPatch('- name: @deepseek-ai/dsh-client-ui-goal\n  id: \'ui-goal\'\n', 'ui-goal', true)
    assert.equal(reordered.createdRow, false)
    assert.equal(reordered.content, '- name: @deepseek-ai/dsh-client-ui-goal\n  id: \'ui-goal\'\n  disabled: true\n')
  })

  it('refuses an ambiguous top-level id instead of appending a potentially duplicate override', () => {
    const content = '- name: something\n  id: !!js targetId\n'
    assert.throws(() => renderDisabledPatch(content, 'ui-goal', true), PatchError)
    assert.deepEqual(inspectProfileOverride(content, 'ui-goal'), { state: 'unavailable', reason: 'ambiguous_top_level_id' })
  })
})

describe('effective profile override state and restore inheritance', () => {
  it('distinguishes inherited, explicit enable and explicit disable', () => {
    assert.deepEqual(inspectProfileOverride('- id: ui-jobs\n  disabled: true\n', 'ui-goal'), { state: 'inherited' })
    assert.deepEqual(inspectProfileOverride('- id: ui-goal\n  disabled: false\n', 'ui-goal'), { state: 'explicitly-enabled' })
    assert.deepEqual(inspectProfileOverride('- id: ui-goal\n  disabled: true\n', 'ui-goal'), { state: 'explicitly-disabled' })
    assert.equal(inspectProfileOverride(renderDisabledPatch('[]\n', 'ui-goal', false).content, 'ui-goal').state, 'explicitly-enabled')
    assert.equal(inspectProfileOverride(renderDisabledPatch('[]\n', 'ui-goal', true).content, 'ui-goal').state, 'explicitly-disabled')
  })

  it('restores inheritance by deleting only disabled and preserving fields, comments and !!js', () => {
    const input = `# keep me
- id: ui-goal
  name: '@deepseek-ai/dsh-client-ui-goal'
  config: !!js ctx.profile.goal
  disabled: true # temporary
- id: ui-jobs
  disabled: false
`
    const result = renderRestoreInheritance(input, 'ui-goal')
    assert.equal(result.content, `# keep me
- id: ui-goal
  name: '@deepseek-ai/dsh-client-ui-goal'
  config: !!js ctx.profile.goal
  # temporary
- id: ui-jobs
  disabled: false
`)
  })

  it('removes a minimal override row and leaves a canonical empty sequence', () => {
    const result = renderRestoreInheritance('- id: ui-goal\n  disabled: true\n', 'ui-goal')
    assert.equal(result.content, '[]\n')
    assert.equal(inspectProfileOverride(result.content, 'ui-goal').state, 'inherited')
  })

  it('does not alter a nested insert during restore', () => {
    const input = '- insert:\n    - id: ui-goal\n      disabled: true\n- id: ui-goal\n  disabled: false\n'
    const result = renderRestoreInheritance(input, 'ui-goal')
    assert.equal(result.content, '- insert:\n    - id: ui-goal\n      disabled: true\n')
  })

  it('keeps CRLF while restoring inheritance', () => {
    const result = renderRestoreInheritance('- id: ui-jobs\r\n  disabled: false\r\n- id: ui-goal\r\n  disabled: true\r\n', 'ui-goal')
    assert.equal(result.content, '- id: ui-jobs\r\n  disabled: false\r\n')
  })

  it('preserves a target id inline comment while removing its minimal row', () => {
    const result = renderRestoreInheritance('- id: ui-goal # explanation\n  disabled: true\n', 'ui-goal')
    assert.equal(result.content, '# explanation\n[]\n')
  })
})

describe('applyDisabledOverride (official lock + atomic write)', () => {
  function tempFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-'))
    const file = join(dir, 'cordis.patch.yml')
    writeFileSync(file, content, 'utf8')
    return file
  }

  it('commits through the official writer lock + atomic replace (no litter left behind)', async () => {
    const file = tempFile('[]\n')
    const result = await applyDisabledOverride(file, 'ui-goal', true)
    assert.equal(result.changed, true)
    assert.equal(result.createdRow, true)
    assert.equal(readFileSync(file, 'utf8'), '- id: ui-goal\n  disabled: true\n')
    // no temp or lock siblings left
    const dir = file.slice(0, file.lastIndexOf('/'))
    assert.deepEqual(readDir(dir), ['cordis.patch.yml'])
  })

  it('preserves the original file mode through the replace', async () => {
    const file = tempFile('[]\n')
    const originalMode = statSync(file).mode & 0o777
    await applyDisabledOverride(file, 'ui-goal', true)
    assert.equal(statSync(file).mode & 0o777, originalMode)
  })

  it('two concurrent writers on the same file both land (lock serializes; no lost update)', async () => {
    const file = tempFile('[]\n')
    await Promise.all([
      applyDisabledOverride(file, 'ui-goal', true),
      applyDisabledOverride(file, 'ui-jobs', true),
    ])
    const content = readFileSync(file, 'utf8')
    assert.ok(content.includes('- id: ui-goal\n  disabled: true\n'), content)
    assert.ok(content.includes('- id: ui-jobs\n  disabled: true\n'), content)
  })

  it('11. concurrent external edit between read and replace → refuses, does not overwrite', async () => {
    const file = tempFile('[]\n')
    let reads = 0
    const deps: ApplyDeps = {
      read: () => {
        reads += 1
        return reads === 1 ? '[]\n' : '# externally edited\n- id: ui-jobs\n  disabled: true\n'
      },
      writeAtomic: async () => { assert.fail('must not write on conflict') },
      lock: async (_file, operation) => operation(),
    }
    await assert.rejects(() => applyDisabledOverride(file, 'ui-goal', true, deps), ConcurrentEditError)
    // the real file is untouched
    assert.equal(readFileSync(file, 'utf8'), '[]\n')
  })

  it('no-op when the override already matches (no write, no re-read conflict risk)', async () => {
    const file = tempFile('- id: ui-goal\n  disabled: true\n')
    const result = await applyDisabledOverride(file, 'ui-goal', true)
    assert.equal(result.changed, false)
    assert.equal(readFileSync(file, 'utf8'), '- id: ui-goal\n  disabled: true\n')
  })

  it('missing profile patch → refuses to create it implicitly', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-'))
    await assert.rejects(() => applyDisabledOverride(join(dir, 'nope.yml'), 'ui-goal', true), PatchError)
  })

  it('preflights known writer refusal paths without attempting a mutation', () => {
    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-'))
    assert.deepEqual(preflightProfileMutation(join(dir, 'missing.yml'), 'ui-goal'), {
      status: 'unwritable', reason: 'profile_patch_missing',
    })

    const duplicate = tempFile('- id: ui-goal\n  disabled: true\n- id: ui-goal\n  disabled: false\n')
    assert.deepEqual(preflightProfileMutation(duplicate, 'ui-goal'), {
      status: 'unwritable', reason: 'duplicate_top_level_row',
    })

    const nonLiteral = tempFile('- id: ui-goal\n  disabled: !!js ctx.flag\n')
    assert.deepEqual(preflightProfileMutation(nonLiteral, 'ui-goal'), {
      status: 'unwritable', reason: 'non_literal_disabled',
    })

    const ambiguous = tempFile('- name: something\n  id: !!js targetId\n')
    assert.deepEqual(preflightProfileMutation(ambiguous, 'ui-goal'), {
      status: 'unwritable', reason: 'ambiguous_top_level_id',
    })
  })

  it('reads one regular profile snapshot coherently and rejects symlink or directory targets', async () => {
    const file = tempFile('- id: ui-goal\n  disabled: true\n')
    const snapshot = inspectProfileSnapshot(file, ['ui-goal', 'ui-jobs'])
    assert.deepEqual(snapshot.profileOverrides.get('ui-goal'), { state: 'explicitly-disabled' })
    assert.deepEqual(snapshot.profileOverrides.get('ui-jobs'), { state: 'inherited' })
    assert.deepEqual(snapshot.profilePersistence.get('ui-goal'), { status: 'writable' })

    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-link-'))
    const link = join(dir, 'cordis.patch.yml')
    symlinkSync(file, link)
    assert.deepEqual(preflightProfileMutation(link, 'ui-goal'), { status: 'unwritable', reason: 'profile_patch_unreadable' })
    await assert.rejects(() => applyDisabledOverride(link, 'ui-goal', true), PatchError)
    assert.deepEqual(preflightProfileMutation(dir, 'ui-goal'), { status: 'unwritable', reason: 'profile_patch_unreadable' })
  })

  it('restore uses the same lock, optimistic concurrency refusal and atomic writer', async () => {
    const file = tempFile('- id: ui-goal\n  disabled: true\n')
    let reads = 0
    const deps: ApplyDeps = {
      read: () => {
        reads += 1
        return reads === 1 ? '- id: ui-goal\n  disabled: true\n' : '# external\n[]\n'
      },
      writeAtomic: async () => { assert.fail('must not write on conflict') },
      lock: async (_file, operation) => operation(),
    }
    await assert.rejects(() => restoreDisabledInheritance(file, 'ui-goal', deps), ConcurrentEditError)
    assert.equal(readFileSync(file, 'utf8'), '- id: ui-goal\n  disabled: true\n')
  })
})

function readDir(dir: string): string[] {
  return readdirSync(dir) as string[]
}
