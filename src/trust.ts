/**
 * Browser-trust fence for the plugin's same-origin API, replicating the
 * official DSH `/api` fence (`@deepseek-ai/dsh-client-connection`'s internal
 * api-request-trust.ts — the function is NOT publicly exported from the npm
 * package, so the official semantics are reimplemented here against the
 * rc.6 behavior):
 *
 *  1. Host fence (DNS-rebinding defense), applied to every request: the Host
 *     header must be loopback or a deployment `trustedHosts` authority. A
 *     browser fills Host from the URL it believes it is talking to, so a
 *     rebound page carries the attacker's domain here even though the socket
 *     lands on this server. There is no marker shortcut — a browser read over
 *     plain HTTP arrives with neither Origin nor Fetch-Metadata.
 *  2. Cross-site fence: `sec-fetch-site: cross-site` is refused regardless
 *     of Origin.
 *  3. Origin fence: when a browser attaches an Origin it must equal the Host
 *     authority exactly (same normalization). ABSENT Origin is not a
 *     rejection — the Host fence above already bound the request. The
 *     literal "null" origin (sandboxed iframes, file: pages) fails URL
 *     parsing and is refused.
 *
 * Loopback does NOT bypass the Origin / sec-fetch-site checks — the official
 * fence applies them to every request. LAN / `--trusted-host` deployments
 * pass through `trustedHosts` (the values `webRuntime.trustedHosts` exposes:
 * LAN IP literals + explicit invocation authorities).
 */

import type { IncomingHttpHeaders } from 'node:http'

/** The request facts the fence reads. */
export interface TrustRequest {
  headers: IncomingHttpHeaders
}

function header(headers: IncomingHttpHeaders, name: string): string | undefined {
  const value = headers[name]
  return typeof value === 'string' ? value : undefined
}

/** Normalized URL of a Host-header authority, or undefined when unparsable. */
function parseAuthority(authority: string): URL | undefined {
  try {
    // http: is a WHATWG "special scheme": parsing yields a non-empty hostname or throws.
    return new URL(`http://${authority}`)
  } catch {
    return undefined
  }
}

/**
 * Official loopback classification: localhost, the bracketed IPv6 loopback
 * literal, or any IPv4 address in 127/8 (all four octets numeric, ≤ 255).
 * A WHATWG URL hostname keeps IPv6 brackets, so the bracket form is the one
 * that appears here.
 */
export function isLoopbackHostname(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '[::1]') return true
  const parts = hostname.split('.')
  return parts.length === 4
    && parts[0] === '127'
    && parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)
}

/**
 * Canonical form of a parsed authority: `hostname` when no port was written,
 * else `hostname:port`. The port is judged from URL parses under both special
 * schemes (their default ports differ, so `:80` and `:443` still count as
 * explicit), never from the raw string.
 */
function canonicalAuthority(entry: string, entryUrl: URL): string {
  const port = entryUrl.port !== '' ? entryUrl.port : new URL(`https://${entry}`).port
  return port === '' ? entryUrl.hostname : `${entryUrl.hostname}:${port}`
}

/**
 * Whether the request authority matches a `trustedHosts` entry. An entry with
 * an explicit port matches that exact authority; a port-less entry matches
 * the hostname on any port. Both sides compare through WHATWG normalization.
 */
export function isTrustedAuthority(hostUrl: URL, trustedHosts: readonly string[]): boolean {
  return trustedHosts.some((entry) => {
    const entryUrl = parseAuthority(entry)
    if (entryUrl === undefined) return false
    return canonicalAuthority(entry, entryUrl) === entryUrl.hostname
      ? entryUrl.hostname === hostUrl.hostname
      : entryUrl.host === hostUrl.host
  })
}

/**
 * Decide whether one plugin-API request may reach the routes.
 * @param headers - Node HTTP request headers.
 * @param trustedHosts - non-loopback authorities this deployment serves:
 * exact `host:port`, or port-less `host` matching any port.
 * @returns true when the Host is ours (loopback or trusted) and any attached
 * browser markers are same-origin.
 */
export function isTrustedRequest(headers: IncomingHttpHeaders, trustedHosts: readonly string[]): boolean {
  const host = header(headers, 'host')
  if (host === undefined) return false
  const hostUrl = parseAuthority(host)
  if (hostUrl === undefined) return false
  if (!isLoopbackHostname(hostUrl.hostname) && !isTrustedAuthority(hostUrl, trustedHosts)) return false
  if (header(headers, 'sec-fetch-site') === 'cross-site') return false
  const origin = header(headers, 'origin')
  if (origin === undefined) return true
  try {
    return new URL(origin).host === hostUrl.host
  } catch {
    return false
  }
}
