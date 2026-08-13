/**
 * dsh-builtin-toggles — Host half.
 *
 * A narrow manager for a small, explicitly allowlisted set of official
 * built-in Web UI plugins. Registers one same-origin API on the web surface:
 *
 *   GET  /api/builtin-toggles           → current Loader snapshot
 *   POST /api/builtin-toggles/<id>      → { disabled: boolean } (policy-gated)
 *
 * The POST path re-checks every security rule server-side (see policy.ts and
 * mutate.ts); the browser hiding a switch is never the security boundary.
 *
 * No tools are registered, no model-facing service is touched, and nothing
 * in the host composition is modified except the profile patch layer.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import type { Entry } from '@deepseek-ai/cordis-plugin-loader'
import type {} from '@deepseek-ai/dsh-host-webserver'
import { runToggle, type EntryHandle } from './mutate.ts'
import { classifyEntry, type EntryFacts, type SnapshotPlugin } from './policy.ts'
import { applyDisabledOverride, profilePatchPath } from './profile-patch.ts'

/** Cordis plugin identity. */
export const name = 'builtin-toggles'

/** Services required from the web composition. */
export const inject = ['webServer', 'loader']

/** The same-origin API prefix. */
export const API_PREFIX = '/api/builtin-toggles'

/** Maximum accepted POST body. */
const MAX_BODY_BYTES = 4096

/** Runtime mirror of the Cordis FiberState const enum (no runtime import). */
const FIBER_PHASE: Record<number, string | null> = {
  0: 'pending',
  1: 'loading',
  2: 'active',
  3: 'failed',
  4: null,
  5: 'unloading',
}

/** Map a loader entry to its current Cordis phase, or null when unmounted. */
function fiberPhase(entry: Entry): string | null {
  if (entry.fiber === undefined) return null
  return FIBER_PHASE[entry.fiber.state] ?? null
}

/** Facts the policy needs, projected from one loader entry. */
function entryFacts(entry: Entry): EntryFacts {
  return {
    id: entry.options.id,
    name: entry.options.name,
    disabled: entry.disabled,
    phase: fiberPhase(entry),
  }
}

/** Snapshot rows: manageable + official + self (external packages stay invisible). */
export function buildSnapshot(entries: Entry[]): SnapshotPlugin[] {
  const seen = new Set<string>()
  const plugins: SnapshotPlugin[] = []
  for (const entry of entries) {
    if (entry.options.group) continue
    if (typeof entry.options.name !== 'string') continue
    if (seen.has(entry.options.id)) continue
    seen.add(entry.options.id)
    const classified = classifyEntry(entryFacts(entry))
    if (!classified.manageable && !classified.name.startsWith('@deepseek-ai/') && classified.reason !== 'self') {
      continue
    }
    plugins.push(classified)
  }
  return plugins
}

/* ── browser trust fence (DNS-rebinding / cross-site defense) ─────────────── */

function headerValue(headers: IncomingMessage['headers'], name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

function isLoopbackHostname(hostname: string): boolean {
  return hostname === 'localhost'
    || hostname === '::1'
    || hostname === '127.0.0.1'
    || hostname === '::ffff:127.0.0.1'
    || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)
}

/**
 * Accept loopback requests outright; for LAN serving, require a same-origin
 * browser marker (Origin matching Host). A rebound page carries an attacker
 * Host here, and a cross-site fetch carries a mismatching Origin — both
 * refuse. This is a defense-in-depth fence for a local UI manager, not auth.
 */
export function isLocalRequest(req: IncomingMessage): boolean {
  const host = headerValue(req.headers, 'host')
  if (host === undefined) return false
  let authority: URL
  try {
    authority = new URL(`http://${host}`)
  } catch {
    return false
  }
  if (isLoopbackHostname(authority.hostname)) return true
  const origin = headerValue(req.headers, 'origin')
  if (origin === undefined) return false
  try {
    return new URL(origin).host === host
  } catch {
    return false
  }
}

/* ── HTTP plumbing ────────────────────────────────────────────────────────── */

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, maxBytes: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > maxBytes) {
        reject(new Error('request body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Wrap the loader's raw entries in the handle shape the orchestrator needs. */
function entryHandle(entry: Entry): EntryHandle {
  return {
    facts: entryFacts(entry),
    ownDisabled: entry.options.disabled ?? undefined,
    update: (options) => entry.update(options),
  }
}

function findEntryByShortId(ctx: Context, id: string): Entry | undefined {
  for (const entry of ctx.loader.entries()) {
    if (entry.options.group) continue
    if (entry.options.id === id) return entry
  }
  return undefined
}

/** Register the same-origin API; runs for the lifetime of the fiber. */
export function apply(ctx: Context): void {
  ctx.effect(() => {
    const dispose = ctx.webServer.register({
      kind: 'prefix',
      path: API_PREFIX,
      handler: async (req, res) => {
        if (!isLocalRequest(req)) {
          sendJson(res, 403, { ok: false, error: 'forbidden', message: 'builtin-toggles: untrusted request origin' })
          return
        }
        const pathname = (req.url ?? '/').split('?')[0] ?? '/'
        const method = req.method ?? 'GET'

        if (method === 'GET' && pathname === API_PREFIX) {
          sendJson(res, 200, { plugins: buildSnapshot([...ctx.loader.entries()]) })
          return
        }

        const match = /^\/api\/builtin-toggles\/([^/]+)$/.exec(pathname)
        if (method === 'POST' && match !== null) {
          const id = decodeURIComponent(match[1]!)
          let rawBody: unknown
          try {
            const text = await readBody(req, MAX_BODY_BYTES)
            rawBody = text === null ? undefined : JSON.parse(text)
          } catch {
            rawBody = undefined // → invalid_body 400 below
          }
          const result = await runToggle(
            {
              patchFile: profilePatchPath('web'),
              findEntry: (targetId) => {
                const entry = findEntryByShortId(ctx, targetId)
                return entry === undefined ? undefined : entryHandle(entry)
              },
              persist: (file, targetId, disabled) => {
                const applied = applyDisabledOverride(file, targetId, disabled)
                return { changed: applied.changed }
              },
            },
            id,
            rawBody,
          )
          sendJson(res, result.status, result.body)
          return
        }

        sendJson(res, 404, { ok: false, error: 'not_found', message: `builtin-toggles: no route for ${method} ${pathname}` })
      },
    })
    return dispose
  }, 'builtin-toggles: same-origin API')
}
