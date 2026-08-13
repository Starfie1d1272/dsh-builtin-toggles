/**
 * Profile patch writer tests: textual, conservative, atomic.
 * The profile patch may contain comments, `!!js` expressions and structure
 * we do not understand — the writer must preserve all of it.
 */

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it } from 'node:test'
import {
  applyDisabledOverride,
  ConcurrentEditError,
  PatchError,
  renderDisabledPatch,
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
})

describe('applyDisabledOverride (fs layer)', () => {
  function tempFile(content: string): string {
    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-'))
    const file = join(dir, 'cordis.patch.yml')
    writeFileSync(file, content, 'utf8')
    return file
  }

  it('writes through a sibling temp + atomic rename (no partial file on success)', () => {
    const file = tempFile('[]\n')
    const result = applyDisabledOverride(file, 'ui-goal', true)
    assert.equal(result.changed, true)
    assert.equal(result.createdRow, true)
    assert.equal(readFileSync(file, 'utf8'), '- id: ui-goal\n  disabled: true\n')
    // no temp litter
    const dir = file.slice(0, file.lastIndexOf('/'))
    const leftovers = readDir(dir).filter((name) => name.includes('.tmp'))
    assert.deepEqual(leftovers, [])
  })

  it('11. concurrent external edit between read and replace → refuses, does not overwrite', () => {
    const file = tempFile('[]\n')
    let reads = 0
    const deps = {
      read: () => {
        reads += 1
        return reads === 1 ? '[]\n' : '# externally edited\n- id: ui-jobs\n  disabled: true\n'
      },
      writeAtomic: () => { assert.fail('must not write on conflict') },
    }
    assert.throws(() => applyDisabledOverride(file, 'ui-goal', true, deps), ConcurrentEditError)
    // the real file is untouched
    assert.equal(readFileSync(file, 'utf8'), '[]\n')
  })

  it('no-op when the override already matches (no write, no re-read conflict risk)', () => {
    const file = tempFile('- id: ui-goal\n  disabled: true\n')
    const result = applyDisabledOverride(file, 'ui-goal', true)
    assert.equal(result.changed, false)
    assert.equal(readFileSync(file, 'utf8'), '- id: ui-goal\n  disabled: true\n')
  })

  it('missing profile patch → refuses to create it implicitly', () => {
    const dir = mkdtempSync(join(tmpdir(), 'builtin-toggles-'))
    assert.throws(() => applyDisabledOverride(join(dir, 'nope.yml'), 'ui-goal', true), PatchError)
  })
})

function readDir(dir: string): string[] {
  return readdirSync(dir) as string[]
}
