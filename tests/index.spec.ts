/**
 * Host route helpers: malformed request input must become a clean 4xx,
 * never a throw into the HTTP layer and never a mutation.
 */

import assert from 'node:assert/strict'
import { PassThrough } from 'node:stream'
import { describe, it } from 'node:test'
import type { IncomingHttpHeaders, IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import { apply, buildSnapshot, decodeEntryId, INSPECTION_API_PATH } from '../src/index.ts'

type ApiHandler = (req: IncomingMessage, res: ServerResponse) => Promise<void>

function testApi(trustedHosts: string[], entries: Entry[]): { handler: ApiHandler; updates: Array<boolean | null | undefined> } {
  let handler: ApiHandler | undefined
  const updates: Array<boolean | null | undefined> = []
  for (const entry of entries) {
    entry.update = async (options) => { updates.push(options.disabled) }
  }
  const context = {
    get: () => ({ trustedHosts }),
    loader: { entries: () => entries },
    webServer: { register: (route: { handler: ApiHandler }) => { handler = route.handler; return () => {} } },
    effect: (callback: () => (() => void)) => callback(),
  } as unknown as Context
  apply(context)
  assert.ok(handler)
  return { handler, updates }
}

async function invoke(handler: ApiHandler, method: string, url: string, headers: IncomingHttpHeaders, body?: string): Promise<{ status: number; body: unknown }> {
  const request = new PassThrough()
  Object.assign(request, { method, url, headers })
  let status = 200
  let payload = ''
  const response = {
    set statusCode(value: number) { status = value },
    get statusCode() { return status },
    setHeader: () => undefined,
    end: (value?: string) => { payload = value ?? '' },
  } as unknown as ServerResponse
  const pending = handler(request as unknown as IncomingMessage, response)
  request.end(body)
  await pending
  return { status, body: JSON.parse(payload) }
}

describe('decodeEntryId', () => {
  it('plain ids pass through', () => {
    assert.equal(decodeEntryId('ui-goal'), 'ui-goal')
    assert.equal(decodeEntryId('builtin-toggles'), 'builtin-toggles')
  })

  it('valid percent-encoding decodes', () => {
    assert.equal(decodeEntryId('%75i-goal'), 'ui-goal')
    assert.equal(decodeEntryId('ui-%67oal'), 'ui-goal')
  })

  it('malformed percent-encoding → null (400 path), no throw', () => {
    assert.equal(decodeEntryId('%ZZ'), null)
    assert.equal(decodeEntryId('%'), null)
    assert.equal(decodeEntryId('%2'), null)
    assert.equal(decodeEntryId('ui-goal%'), null)
    assert.equal(decodeEntryId('%GG%HH'), null)
  })

  it('the decoded value is NOT a security bypass: it still goes through the exact allowlist', () => {
    // '%75i-goal' decodes to 'ui-goal' which IS allowlisted — that is fine.
    // A decoded value that is not on the allowlist is rejected by the policy
    // gate before any mutation, e.g. '%75i-commands' decodes to 'ui-commands'.
    assert.equal(decodeEntryId('%75i-commands'), 'ui-commands')
  })
})

describe('legacy snapshot compatibility', () => {
  it('keeps GET /api/builtin-toggles rows unchanged while v1 inspection is additive', () => {
    const entries = [
      { options: { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal' }, disabled: false, fiber: { state: 2 } },
      { options: { id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future' }, disabled: true, fiber: undefined },
      { options: { id: 'third-party', name: '@example/plugin' }, disabled: false, fiber: { state: 3 } },
    ] as unknown as Entry[]
    assert.deepEqual(buildSnapshot(entries), [
      { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal', disabled: false, phase: 'active', manageable: true },
      { id: 'ui-future', name: '@deepseek-ai/dsh-client-ui-future', disabled: true, phase: null, manageable: false, reason: 'unlisted' },
    ])
  })

  it('excludes per-session Agent Preset rows from the legacy Host snapshot', () => {
    const presets = {
      id: 'include:agent-presets', options: { id: 'agent-presets', name: '@deepseek-ai/dsh-agent-presets' },
      parent: { tree: { ctx: { fiber: { entry: undefined } } } },
    } as unknown as Entry
    const presetRow = {
      id: 'include:agent-presets:tool-bash', options: { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
      disabled: false, fiber: { state: 2 },
      parent: { tree: { ctx: { fiber: { entry: presets } } } },
    } as unknown as Entry
    const hostRow = {
      id: 'include:tool-bash', options: { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash' },
      disabled: false, fiber: { state: 2 },
      parent: { tree: { ctx: { fiber: { entry: { id: 'include', options: { id: 'include', name: 'cordis:include' }, parent: { tree: { ctx: { fiber: { entry: undefined } } } } } } } } },
    } as unknown as Entry
    assert.deepEqual(buildSnapshot([hostRow, presetRow]), [
      { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', disabled: false, phase: 'active', manageable: false, reason: 'unlisted' },
    ])
  })
})

describe('loopback-only mutation transport', () => {
  const goal = (): Entry => ({ options: { id: 'ui-goal', name: '@deepseek-ai/dsh-client-ui-goal' }, disabled: false } as unknown as Entry)

  it('permits loopback inspection and marks its mutation transport allowed', async () => {
    const api = testApi(['192.168.1.5:3080'], [goal()])
    const result = await invoke(api.handler, 'GET', INSPECTION_API_PATH, { host: '127.0.0.1:3080', origin: 'http://127.0.0.1:3080', 'sec-fetch-site': 'same-origin' })
    assert.equal(result.status, 200)
    assert.equal((result.body as { access: { mutation: string } }).access.mutation, 'allowed')
  })

  it('permits trusted-LAN inspection as read-only and rejects its same-origin POST before any mutation', async () => {
    const api = testApi(['192.168.1.5:3080'], [goal()])
    const headers = { host: '192.168.1.5:3080', origin: 'http://192.168.1.5:3080', 'sec-fetch-site': 'same-origin' }
    const inspection = await invoke(api.handler, 'GET', INSPECTION_API_PATH, headers)
    assert.equal(inspection.status, 200)
    assert.equal((inspection.body as { access: { mutation: string } }).access.mutation, 'loopback-required')
    const mutation = await invoke(api.handler, 'POST', '/api/builtin-toggles/ui-goal', headers, JSON.stringify({ action: 'force-disable' }))
    assert.equal(mutation.status, 403)
    assert.deepEqual(mutation.body, {
      ok: false,
      error: 'loopback_required',
      message: 'builtin-toggles: configuration mutation requires loopback same-origin access',
    })
    assert.deepEqual(api.updates, [])
  })

  it('lets loopback POST continue into the existing policy gate', async () => {
    const api = testApi([], [{ options: { id: 'ui-commands', name: '@deepseek-ai/dsh-client-ui-commands' }, disabled: false } as unknown as Entry])
    const result = await invoke(api.handler, 'POST', '/api/builtin-toggles/ui-commands', { host: 'localhost:3080', origin: 'http://localhost:3080', 'sec-fetch-site': 'same-origin' }, JSON.stringify({ action: 'force-disable' }))
    assert.equal(result.status, 403)
    assert.notEqual((result.body as { error: string }).error, 'loopback_required')
    assert.deepEqual(api.updates, [])
  })
})
