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
 * Every request crosses the official-semantics browser-trust fence
 * (trust.ts), and every mutation is serialized through a process-wide queue
 * — two browser tabs POSTing at once cannot interleave their runtime updates
 * or profile-patch writes.
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
import { isTrustedRequest } from './trust.ts'

/** Cordis plugin identity. */
export const name = 'builtin-toggles'

/** Services required from the web composition. */
export const inject = ['webServer', 'loader']

/** The same-origin API prefix. */
export const API_PREFIX = '/api/builtin-toggles'

/** Maximum accepted POST body. */
const MAX_BODY_BYTES = 4096

/**
 * Decode a URL-encoded plugin id from the request path. Malformed percent
 * encoding (`%ZZ`, dangling `%`) must never throw into the HTTP layer:
 * return null and let the route answer a clean 400 without touching the
 * runtime or the profile patch.
 */
export function decodeEntryId(raw: string): string | null {
  try {
    return decodeURIComponent(raw)
  } catch {
    return null
  }
}

/**
 * Process-wide mutation serialization: every POST runs through this queue,
 * so two browser tabs (or any concurrent callers) can never interleave
 * runtime updates or profile-patch writes. The official per-file writer lock
 * (withFileLock) additionally serializes across processes.
 */
let mutationQueue: Promise<unknown> = Promise.resolve()
export function serializeMutation<T>(run: () => Promise<T>): Promise<T> {
  const next = mutationQueue.then(run, run)
  mutationQueue = next.then(() => undefined, () => undefined)
  return next
}

/** The deployment's non-loopback authorities, per the official trust fence. */
interface WebRuntimeLike {
  trustedHosts: string[]
}

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
        // The deployment's non-loopback authorities, read per request:
        // `webRuntime.trustedHosts` (LAN IP literals + explicit
        // --trusted-host values) is provided only after the server binds,
        // which may be after this plugin's effect runs — a stale capture
        // would wrongly lock out LAN deployments.
        const webRuntime = ctx.get('webRuntime') as WebRuntimeLike | undefined
        const trustedHosts = webRuntime?.trustedHosts ?? []

        if (!isTrustedRequest(req.headers, trustedHosts)) {
          sendJson(res, 403, { ok: false, error: 'forbidden', message: 'builtin-toggles: untrusted request' })
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
          const id = decodeEntryId(match[1]!)
          if (id === null) {
            sendJson(res, 400, { ok: false, error: 'invalid_id', message: 'builtin-toggles: malformed percent-encoding in plugin id' })
            return
          }
          let rawBody: unknown
          try {
            const text = await readBody(req, MAX_BODY_BYTES)
            rawBody = text === null ? undefined : JSON.parse(text)
          } catch {
            rawBody = undefined // → invalid_body 400 below
          }
          // One mutation at a time, process-wide: tabs and scripts share the
          // queue, so runtime updates and patch writes never interleave.
          const result = await serializeMutation(() => runToggle(
            {
              patchFile: profilePatchPath('web'),
              findEntry: (targetId) => {
                const entry = findEntryByShortId(ctx, targetId)
                return entry === undefined ? undefined : entryHandle(entry)
              },
              persist: async (file, targetId, disabled) => {
                const applied = await applyDisabledOverride(file, targetId, disabled)
                return { changed: applied.changed }
              },
            },
            id,
            rawBody,
          ))
          sendJson(res, result.status, result.body)
          return
        }

        sendJson(res, 404, { ok: false, error: 'not_found', message: `builtin-toggles: no route for ${method} ${pathname}` })
      },
    })
    return dispose
  }, 'builtin-toggles: same-origin API')
}
