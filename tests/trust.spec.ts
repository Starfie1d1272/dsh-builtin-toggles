/**
 * Browser-trust fence tests: the plugin's API must accept exactly what the
 * official DSH /api fence accepts — loopback or trusted Host, no
 * `sec-fetch-site: cross-site`, and a same-origin Origin when one is sent.
 */

import assert from 'node:assert/strict'
import type { IncomingHttpHeaders } from 'node:http'
import { describe, it } from 'node:test'
import { isTrustedRequest } from '../src/trust.ts'

function headers(partial: Record<string, string>): IncomingHttpHeaders {
  return { ...partial }
}

describe('isTrustedRequest', () => {
  it('loopback Host with no browser markers → accepted (curl-style read)', () => {
    assert.equal(isTrustedRequest(headers({ host: '127.0.0.1:3080' }), []), true)
    assert.equal(isTrustedRequest(headers({ host: 'localhost:3080' }), []), true)
    assert.equal(isTrustedRequest(headers({ host: '[::1]:3080' }), []), true)
    assert.equal(isTrustedRequest(headers({ host: '127.9.9.9:3080' }), []), true)
  })

  it('LAN Host with matching trustedHosts entry → accepted', () => {
    assert.equal(isTrustedRequest(headers({ host: '192.168.1.5:3080' }), ['192.168.1.5:3080']), true)
    // port-less trusted entry matches the hostname on any port
    assert.equal(isTrustedRequest(headers({ host: '192.168.1.5:9999' }), ['192.168.1.5']), true)
    // named LAN host with exact authority
    assert.equal(isTrustedRequest(headers({ host: 'harness.internal:3080' }), ['harness.internal:3080']), true)
  })

  it('LAN Host without a trustedHosts entry → refused (bad Host)', () => {
    assert.equal(isTrustedRequest(headers({ host: '192.168.1.5:3080' }), []), false)
    assert.equal(isTrustedRequest(headers({ host: 'evil.example:3080' }), ['192.168.1.5']), false)
  })

  it('missing or unparsable Host → refused', () => {
    assert.equal(isTrustedRequest(headers({}), []), false)
    assert.equal(isTrustedRequest(headers({ host: 'not a host:^^' }), []), false)
  })

  it('sec-fetch-site: cross-site → refused regardless of Host or Origin', () => {
    assert.equal(isTrustedRequest(headers({ host: '127.0.0.1:3080', 'sec-fetch-site': 'cross-site' }), []), false)
    // loopback does NOT bypass the cross-site fence
    assert.equal(isTrustedRequest(headers({
      host: '127.0.0.1:3080',
      'sec-fetch-site': 'cross-site',
      origin: 'http://127.0.0.1:3080',
    }), []), false)
    assert.equal(isTrustedRequest(headers({
      host: '192.168.1.5:3080',
      'sec-fetch-site': 'cross-site',
      origin: 'http://192.168.1.5:3080',
    }), ['192.168.1.5:3080']), false)
  })

  it('same-origin browser markers → accepted (same-site fetch)', () => {
    assert.equal(isTrustedRequest(headers({
      host: '127.0.0.1:3080',
      origin: 'http://127.0.0.1:3080',
      'sec-fetch-site': 'same-origin',
    }), []), true)
    assert.equal(isTrustedRequest(headers({
      host: '192.168.1.5:3080',
      origin: 'http://192.168.1.5:3080',
      'sec-fetch-site': 'same-origin',
    }), ['192.168.1.5:3080']), true)
  })

  it('mismatching Origin → refused even on loopback (loopback does NOT bypass Origin)', () => {
    assert.equal(isTrustedRequest(headers({
      host: '127.0.0.1:3080',
      origin: 'http://evil.example',
    }), []), false)
    assert.equal(isTrustedRequest(headers({
      host: '127.0.0.1:3080',
      origin: 'http://127.0.0.1:9999',
    }), []), false)
  })

  it('literal "null" Origin (sandboxed iframe / file:) → refused', () => {
    assert.equal(isTrustedRequest(headers({ host: '127.0.0.1:3080', origin: 'null' }), []), false)
  })

  it('no Origin is NOT a rejection (Host fence already bound the request)', () => {
    assert.equal(isTrustedRequest(headers({ host: '127.0.0.1:3080' }), []), true)
    assert.equal(isTrustedRequest(headers({ host: '127.0.0.1:3080', 'sec-fetch-site': 'same-origin' }), []), true)
  })

  it('trustedHosts entries are compared through WHATWG normalization', () => {
    // case-insensitive hostname, redundant default port
    assert.equal(isTrustedRequest(headers({ host: 'LAN.HOST:3080' }), ['lan.host']), true)
    assert.equal(isTrustedRequest(headers({ host: '192.168.1.5:80' }), ['192.168.1.5:80']), true)
  })
})
