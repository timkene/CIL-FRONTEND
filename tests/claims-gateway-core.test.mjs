import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { validClaimsOrigin, signClaimsMutation, CLAIMS_AUDIENCE } from '../lib/claims-gateway-core.ts'

test('Claims mutation origin must match the same HTTPS host', () => {
  assert.equal(validClaimsOrigin('https://cil.example', 'cil.example', 'same-origin'), true)
  assert.equal(validClaimsOrigin('https://attacker.example', 'cil.example', 'cross-site'), false)
  assert.equal(validClaimsOrigin('https://attacker.example', 'cil.example', null), false)
  assert.equal(validClaimsOrigin('http://cil.example', 'cil.example', 'same-origin'), false)
  assert.equal(validClaimsOrigin(null, 'cil.example', 'same-origin'), false)
  assert.equal(validClaimsOrigin('http://localhost:3000', 'localhost:3000', 'same-origin'), true)
})

test('Gateway assertion binds verified identity, session, action, audience and one-use ID', () => {
  const key = 'test-only-gateway-key-12345678901234567890'
  const assertion = signClaimsMutation('operator-1', 'opaque-token', 'claims.pay', key, '{"claim_keys":[]}', 1000, 'unique-request-id-123456789')
  const [encoded, signature] = assertion.split('.')
  assert.equal(signature, createHmac('sha256', key).update(encoded).digest('hex'))
  const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
  assert.deepEqual(payload, {
    sub: 'operator-1', sid: createHash('sha256').update('opaque-token').digest('hex'),
    action: 'claims.pay', aud: CLAIMS_AUDIENCE,
    body_sha256: createHash('sha256').update('{"claim_keys":[]}').digest('hex'),
    iat: 1000, exp: 1030, jti: 'unique-request-id-123456789',
  })
  assert.equal(assertion.includes('opaque-token'), false)
})


test('body hash changes when transmitted JSON bytes change', () => {
  const key = 'test-only-gateway-key-12345678901234567890'
  const one = signClaimsMutation('operator-1', 'opaque-token', 'claims.pay', key, '{"a":1}', 1000, 'unique-request-id-123456789')
  const two = signClaimsMutation('operator-1', 'opaque-token', 'claims.pay', key, '{"a":2}', 1000, 'unique-request-id-123456789')
  assert.notEqual(one, two)
})
