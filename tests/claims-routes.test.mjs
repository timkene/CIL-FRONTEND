import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash, createHmac } from 'node:crypto'
import { NextRequest } from 'next/server.js'
import { POST as login } from '../app/api/nhia/claims/auth/login/route.ts'
import { POST as mutate } from '../app/api/nhia/claims/[action]/route.ts'
import { GET as session } from '../app/api/nhia/claims/auth/session/route.ts'
import { POST as logout } from '../app/api/nhia/claims/auth/logout/route.ts'
import { GET as candidates } from '../app/api/nhia/claims/reconcile-candidates/route.ts'

const signingKey = 'test-signing-key-1234567890123456789012'
const apiKey = 'test-transport-key-1234567890123456789012'
process.env.NHIA_CLAIMS_API_URL = 'https://nhia.test'
process.env.CLAIMS_GATEWAY_SIGNING_KEY = signingKey
process.env.CLAIMS_GATEWAY_API_KEY = apiKey
process.env.VERCEL = '1'

function request(path, method = 'POST', body, headers = {}) {
  return new NextRequest(`https://frontend.test${path}`, {
    method, headers: { host: 'frontend.test', origin: 'https://frontend.test',
      'sec-fetch-site': 'same-origin', 'x-forwarded-for': '203.0.113.9', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}

function response(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
}

test('login rejects cross-origin and sets protected cookie from server response', async () => {
  const old = global.fetch
  const calls = []
  global.fetch = async (url, options) => { calls.push({ url, options }); return response({ token: 'opaque-session' }) }
  try {
    assert.equal((await login(request('/api/nhia/claims/auth/login', 'POST',
      { operator_id: 'op', credential: 'secret' }, { origin: 'https://evil.test' }))).status, 403)
    assert.equal(calls.length, 0)
    const result = await login(request('/api/nhia/claims/auth/login', 'POST',
      { operator_id: 'op', credential: 'secret' }))
    assert.equal(result.status, 200)
    const cookie = result.headers.get('set-cookie')
    assert.match(cookie, /HttpOnly/i)
    assert.match(cookie, /SameSite=strict/i)
    assert.match(cookie, /Path=\/api\/nhia\/claims/i)
    assert.match(cookie, /Max-Age=3600/i)
    assert.equal(calls[0].options.headers['X-Claims-Gateway-Key'], apiKey)
    assert.equal(calls[0].options.headers['X-Claims-Client-IP'], '203.0.113.9')
    assert.notEqual(calls[0].options.headers['X-Claims-Gateway-Key'], signingKey)
    const previous = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    try {
      const secure = await login(request('/api/nhia/claims/auth/login', 'POST',
        { operator_id: 'op', credential: 'secret' }))
      assert.match(secure.headers.get('set-cookie'), /Secure/i)
    } finally { process.env.NODE_ENV = previous }
  } finally { global.fetch = old }
})

test('mutation derives actor, action, audience, body hash and ignores browser assertion headers', async () => {
  const old = global.fetch
  const calls = []
  global.fetch = async (url, options) => {
    calls.push({ url, options })
    return url.endsWith('/auth/session') ? response({ id: 'verified-op', grants: ['claims.pay'] })
      : response({ paid: 1 })
  }
  try {
    const body = { claim_keys: [{ batch_id: 'b', request_id: 'r' }], paid_date: '2026-01-01' }
    const result = await mutate(request('/api/nhia/claims/pay', 'POST', body,
      { cookie: 'claims_payment_session=opaque-session', 'x-claims-assertion': 'forged',
        'x-claims-gateway-key': 'forged', 'x-claims-client-ip': '1.2.3.4' }),
      { params: Promise.resolve({ action: 'pay' }) })
    assert.equal(result.status, 200)
    const call = calls[1]
    const [encoded, signature] = call.options.headers['X-Claims-Assertion'].split('.')
    assert.equal(signature, createHmac('sha256', signingKey).update(encoded).digest('hex'))
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString())
    assert.equal(payload.sub, 'verified-op')
    assert.equal(payload.action, 'claims.pay')
    assert.equal(payload.aud, 'nhia-claims-mutation-v1')
    assert.equal(payload.body_sha256, createHash('sha256').update(call.options.body).digest('hex'))
    assert.equal(call.options.headers['X-Claims-Gateway-Key'], apiKey)
    assert.notEqual(call.options.headers['X-Claims-Assertion'], 'forged')
    assert.equal(call.options.headers['X-Claims-Client-IP'], undefined)
    assert.equal((await mutate(request('/api/nhia/claims/toString', 'POST', body,
      { cookie: 'claims_payment_session=opaque-session' }),
      { params: Promise.resolve({ action: 'toString' }) })).status, 404)
  } finally { global.fetch = old }
})

test('gateway routes reject missing session; logout requires same origin', async () => {
  assert.equal((await session(request('/api/nhia/claims/auth/session', 'GET'))).status, 401)
  assert.equal((await candidates(request('/api/nhia/claims/reconcile-candidates', 'GET'))).status, 401)
  assert.equal((await logout(request('/api/nhia/claims/auth/logout', 'POST', undefined,
    { origin: 'https://evil.test' }))).status, 403)
})

test('missing signing or transport key fails closed', async () => {
  const old = global.fetch
  global.fetch = async url => url.endsWith('/auth/session')
    ? response({ id: 'verified-op', grants: ['claims.pay'] }) : response({ paid: 1 })
  try {
    for (const key of ['CLAIMS_GATEWAY_SIGNING_KEY', 'CLAIMS_GATEWAY_API_KEY']) {
      const value = process.env[key]
      delete process.env[key]
      try {
        const result = await mutate(request('/api/nhia/claims/pay', 'POST', { claim_keys: [] },
          { cookie: 'claims_payment_session=opaque-session' }),
          { params: Promise.resolve({ action: 'pay' }) })
        assert.equal(result.status, 503)
      } finally { process.env[key] = value }
    }
  } finally { global.fetch = old }
})

test('identical transport and signing keys fail closed', async () => {
  const previous = process.env.CLAIMS_GATEWAY_API_KEY
  process.env.CLAIMS_GATEWAY_API_KEY = signingKey
  try {
    const result = await mutate(request('/api/nhia/claims/pay', 'POST', { claim_keys: [] },
      { cookie: 'claims_payment_session=opaque-session' }),
    { params: Promise.resolve({ action: 'pay' }) })
    assert.equal(result.status, 503)
  } finally { process.env.CLAIMS_GATEWAY_API_KEY = previous }
})
