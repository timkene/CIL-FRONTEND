import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url)
const ts = require('typescript')
const { NextRequest } = require('next/server')
const { renderToStaticMarkup } = require('react-dom/server')
const origin = 'https://cil-frontend.vercel.app'
const token = 'synthetic-opaque-session-for-mocked-tests'
const identity = { userId: 'synthetic-staff-id', name: 'Synthetic Staff', email: 'staff@example.test' }
const id = '0123456789abcdef01234567'
const loginBody = { email: identity.email, password: 'synthetic-test-input-only' }
const success = { success: true, user: { name: identity.name, email: identity.email }, session: token }
const response = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Set-Cookie': 'upstream_cookie=must-not-forward' } })
function harness({ env = {}, replies = [], fetchImpl } = {}) {
  const calls = [], cache = new Map()
  const mockFetch = async (url, init) => {
    calls.push({ url: String(url), ...init })
    if (fetchImpl) return fetchImpl(url, init)
    const reply = replies.shift()
    if (!reply) throw new Error('Unexpected upstream request')
    if (reply instanceof Error) throw reply
    return reply
  }
  function load(file, overrides = {}) {
    if (cache.has(file) && !Object.keys(overrides).length) return cache.get(file)
    const exports = {}
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } }).outputText
    const dependency = name => name === 'server-only' ? {} : name === '@/lib/pharmacy-server' ? load('lib/pharmacy-server.ts') : name === '@/lib/pharmacy-api' ? load('lib/pharmacy-api.ts') : require(name)
    vm.runInNewContext(source, { exports, require: dependency, process: { env: { NODE_ENV: 'production', ...env } }, URL, Request, Response, Headers, AbortSignal, Error, fetch: mockFetch, ...overrides })
    cache.set(file, exports)
    return exports
  }
  function request(path, { method = 'GET', body, session, requestOrigin = origin, headers = {}, urlOrigin = origin } = {}) {
    return new NextRequest(urlOrigin + path, { method, headers: {
      ...(requestOrigin !== null ? { Origin: requestOrigin } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(session ? { Cookie: `cil_pharmacy_session=${session}; unrelated=not-forwarded` } : {}), ...headers,
    }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
  }
  return { load, request, calls,
    login: options => load('app/api/pharmacy/auth/login/route.ts').POST(request('/api/pharmacy/auth/login', { method: 'POST', body: loginBody, ...options })),
    me: options => load('app/api/pharmacy/auth/me/route.ts').GET(request('/api/pharmacy/auth/me', { session: token, ...options })),
    mutate: (action = 'assign', options = {}) => load('app/api/pharmacy/[...path]/route.ts').POST(request(`/api/pharmacy/api/orders/${id}/${action}`, { method: 'POST', session: token, body: { aggregatorId: id, expectedVersion: 7 }, ...options }), { params: Promise.resolve({ path: ['api', 'orders', id, action] }) }),
  }
}

test('Pharmacy login renders accessible email/password fields without token storage', () => {
  const h = harness()
  const hooks = { useState: value => [value, () => {}], useRef: value => ({ current: value }) }
  const Page = h.load('app/pharmacy/login/page.tsx', { require: name => name === 'react' ? hooks : name === '@/lib/pharmacy-api' ? {} : require(name) }).default
  const html = renderToStaticMarkup(Page())
  assert.match(html, /Pharmacy staff sign-in/)
  assert.match(html, /type="email"/)
  assert.match(html, /type="password"/)
  assert.match(html, /autoComplete="current-password"/)
})

test('valid login forwards exact credentials, verifies identity, and returns only safe fields', async () => {
  const h = harness({ replies: [response(success), response({ ...identity, session: token })] })
  const res = await h.login()
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { success: true, user: identity })
  assert.equal(h.calls[0].url, 'https://pharmacy-dispatch-api.onrender.com/api/auth/staff/login')
  assert.equal(h.calls[0].method, 'POST')
  assert.deepEqual(JSON.parse(h.calls[0].body), loginBody)
  assert.equal(h.calls[0].headers.Cookie, undefined)
  assert.equal(h.calls[1].headers.Cookie, `staff_session=${token}`)
  assert.equal(h.calls[1].url.endsWith('/api/auth/staff/me'), true)
  for (const call of h.calls) { assert.equal(call.cache, 'no-store'); assert.equal(call.redirect, 'error') }
  assert.equal(res.headers.get('cache-control'), 'no-store')
  const cookie = res.headers.get('set-cookie')
  for (const attr of ['cil_pharmacy_session=', 'HttpOnly', 'Secure', 'SameSite=lax', 'Path=/', 'Max-Age=86400']) assert.ok(cookie.includes(attr), attr)
  assert.doesNotMatch(cookie, /Domain=|upstream_cookie/i)
})

test('development cookie remains HttpOnly and Lax without Secure; exact localhost origin allowed', async () => {
  const h = harness({ env: { NODE_ENV: 'development' }, replies: [response(success), response(identity)] })
  const res = await h.login({ requestOrigin: 'http://localhost:3000', urlOrigin: 'http://localhost:3000' })
  assert.equal(res.status, 200)
  assert.doesNotMatch(res.headers.get('set-cookie'), /Secure/)
  assert.match(res.headers.get('set-cookie'), /HttpOnly/)
  assert.match(res.headers.get('set-cookie'), /SameSite=lax/)
})

for (const [label, reply, expected] of [
  ['invalid credentials', response({ detail: 'email exists but password wrong' }, 401), 401],
  ['validation', response({ detail: [{ input: loginBody.password }] }, 422), 422],
  ['backend outage', response({ debug: token }, 500), 503],
  ['network failure', new Error('network'), 503],
  ['missing token', response({ success: true, user: success.user }), 502],
  ['invalid user', response({ ...success, user: {} }), 502],
  ['false success', response({ ...success, success: false }), 502],
  ['unsafe cookie', response({ ...success, session: 'injected;other=value' }), 502],
  ['unexpected status', response({}, 302), 502],
]) test(`login rejects ${label} without establishing a cookie`, async () => {
  const h = harness({ replies: [reply] })
  const res = await h.login()
  assert.equal(res.status, expected)
  assert.equal(res.headers.get('set-cookie'), null)
  const out = await res.text()
  assert.ok(!out.includes(token)); assert.ok(!out.includes(loginBody.password))
  assert.ok(!out.includes('email exists'))
})

for (const body of [{}, { email: 'bad', password: 'test' }, { ...loginBody, password: '' }]) test('invalid login input never reaches backend', async () => {
  const h = harness(); const res = await h.login({ body })
  assert.equal(res.status, 422); assert.equal(h.calls.length, 0)
})

for (const status of [401, 500]) test(`login requires authoritative staff verification (${status})`, async () => {
  const h = harness({ replies: [response(success), response({ detail: 'Wrong role or expired' }, status)] })
  const res = await h.login()
  assert.equal(res.status, status === 401 ? 401 : 503)
  assert.ok(!String(res.headers.get('set-cookie')).includes(token))
})

test('identity forwards only Pharmacy session server-side and projects safe identity', async () => {
  const h = harness({ replies: [response({ ...identity, role: 'staff', session: token, extra: 'omit' })] })
  const res = await h.me()
  assert.deepEqual(await res.json(), identity)
  assert.equal(h.calls[0].headers.Cookie, `staff_session=${token}`)
  assert.equal(Object.keys(h.calls[0].headers).some(k => /service|authorization/i.test(k)), false)
})

for (const label of ['expired', 'wrong role', 'invalid']) test(`${label} session clears cookie on backend identity 401`, async () => {
  const h = harness({ replies: [response({ detail: label }, 401)] })
  const res = await h.me()
  assert.equal(res.status, 401); assert.match(res.headers.get('set-cookie'), /Max-Age=0/)
})

for (const reply of [response({}, 500), response({ name: 'incomplete' }), new Error('offline')]) test('identity outage/malformed response fails closed without clearing cookie', async () => {
  const h = harness({ replies: [reply] }); const res = await h.me()
  assert.ok([502, 503].includes(res.status)); assert.equal(res.headers.get('set-cookie'), null)
})

test('missing identity cookie requires login without backend access', async () => {
  const h = harness(); const res = await h.me({ session: null })
  assert.equal(res.status, 401); assert.equal(h.calls.length, 0)
})

for (const path of ['/pharmacy', `/pharmacy/orders/${id}`, '/pharmacy/intake/new']) test(`page protection redirects unauthenticated ${path}`, async () => {
  const h = harness(); const res = await h.load('proxy.ts').proxy(h.request(path))
  assert.equal(res.status, 307); assert.equal(new URL(res.headers.get('location')).pathname, '/pharmacy/login')
  assert.equal(h.calls.length, 0)
})

test('page access verifies authoritative identity, login exempt, other routes outside matcher', async () => {
  const h = harness({ replies: [response(identity)] }); const mod = h.load('proxy.ts')
  assert.equal((await mod.proxy(h.request('/pharmacy', { session: token }))).headers.get('x-middleware-next'), '1')
  assert.equal(h.calls.length, 1)
  assert.equal((await mod.proxy(h.request('/pharmacy/login'))).headers.get('x-middleware-next'), '1')
  assert.deepEqual(Array.from(mod.config.matcher), ['/pharmacy/:path*'])
})

for (const status of [401, 503]) test(`page guard fails closed for backend ${status}`, async () => {
  const h = harness({ replies: [response({}, status)] })
  const res = await h.load('proxy.ts').proxy(h.request('/pharmacy', { session: token }))
  assert.equal(res.status, status === 401 ? 307 : 503)
  if (status === 401) assert.match(res.headers.get('set-cookie'), /Max-Age=0/)
  else assert.equal(res.headers.get('set-cookie'), null)
})

for (const [action, body] of [
  ['assign', { aggregatorId: id, expectedVersion: 7 }],
  ['direct-approve', { expectedVersion: 7, adjusted_price: 850, reason: 'Synthetic adjustment' }],
  ['direct-deny', { expectedVersion: 7, reason: 'Synthetic denial' }],
  ['recall', { expectedVersion: 7, reason: 'Synthetic recall' }],
  ['adjust-price', { expectedVersion: 7, totalPrice: 900, reason: 'Synthetic correction' }],
  ['cancel', { expectedVersion: 7, reason: 'Synthetic cancel' }],
  ['approve', undefined], ['reject', { comment: 'Synthetic rejection' }],
  ['close-bidding', undefined], ['clearline-approve', { adjusted_price: 750 }], ['staff-confirm', undefined],
]) test(`${action} proxies exact body/version and staff cookie, with safe browser response`, async () => {
  const h = harness({ replies: [response({ success: true, version: 8, session: token, password: 'omit' })] })
  const res = await h.mutate(action, { body })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { success: true, version: 8 })
  const call = h.calls[0]
  assert.equal(call.url, `https://pharmacy-dispatch-api.onrender.com/api/orders/${id}/${action}`)
  assert.equal(call.headers.Cookie, `staff_session=${token}`)
  assert.equal(h.calls.some(call => call.url.endsWith('/api/auth/staff/me')), false)
  assert.equal(call.method, 'POST')
  assert.equal(call.body, body === undefined ? undefined : JSON.stringify(body))
  assert.equal(res.headers.get('set-cookie'), null)
  assert.equal(h.calls.length, 1)
})

for (const [status, detail] of [[401, 'Expired'], [409, 'Order changed'], [422, 'Reason required'], [500, 'Internal details']]) test(`mutation ${status} is preserved safely, never replayed`, async () => {
  const h = harness({ replies: [response({ detail }, status)] })
  const res = await h.mutate()
  assert.equal(res.status, status); assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, `https://pharmacy-dispatch-api.onrender.com/api/orders/${id}/assign`)
  if (status === 401) assert.match(res.headers.get('set-cookie'), /Max-Age=0/)
  else assert.equal(res.headers.get('set-cookie'), null)
  if ([409, 422].includes(status)) assert.deepEqual(await res.json(), { detail })
  if (status === 500) assert.ok(!(await res.text()).includes(detail))
})

test('mutation missing session never reaches upstream; intended endpoint rejects invalid session', async () => {
  const missing = harness(); assert.equal((await missing.mutate('assign', { session: null })).status, 401); assert.equal(missing.calls.length, 0)
  const wrong = harness({ replies: [response({}, 401)] }); assert.equal((await wrong.mutate()).status, 401); assert.equal(wrong.calls.length, 1)
})

for (const requestOrigin of ['https://evil.example', 'https://cil-frontend.vercel.app.evil.example', 'null', null]) test(`reject foreign/missing origin ${requestOrigin} on login/mutation/logout`, async () => {
  const h = harness()
  assert.equal((await h.login({ requestOrigin })).status, 403)
  assert.equal((await h.mutate('assign', { requestOrigin })).status, 403)
  const res = await h.load('app/api/pharmacy/auth/logout/route.ts').POST(h.request('/api/pharmacy/auth/logout', { method: 'POST', requestOrigin, session: token }))
  assert.equal(res.status, 403); assert.equal(res.headers.get('set-cookie'), null); assert.equal(h.calls.length, 0)
})

test('production origin validation ignores spoofed forwarded-host and rejects cross-site metadata', async () => {
  const h = harness()
  assert.equal((await h.login({ requestOrigin: 'https://evil.example', headers: { host: 'evil.example', 'x-forwarded-host': 'evil.example' } })).status, 403)
  assert.equal((await h.login({ headers: { 'sec-fetch-site': 'cross-site' } })).status, 403)
  assert.equal((await h.login({ requestOrigin: 'http://localhost:3000', urlOrigin: 'http://localhost:3000' })).status, 403)
})

test('configured exact production origin allowed without wildcard previews', async () => {
  const h = harness({ env: { CIL_PHARMACY_ORIGIN: 'https://cil.example.test' }, replies: [response(success), response(identity)] })
  assert.equal((await h.login({ requestOrigin: 'https://cil.example.test', urlOrigin: 'https://cil.example.test' })).status, 200)
})

for (const path of [['https:', 'evil.example'], ['api', 'orders', '..', 'assign'], ['api', 'auth', 'staff', 'login'], ['api', 'orders', id, 'klaire-callback'], ['api', 'orders', id, 'fulfill'], ['api', 'orders', id, 'constructor']]) test(`reject non-allowlisted proxy path ${path.join('/')}`, async () => {
  const h = harness(); const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(h.request('/api/pharmacy/invalid', { method: 'POST', session: token }), { params: Promise.resolve({ path }) })
  assert.equal(res.status, 404); assert.equal(h.calls.length, 0)
})

test('reject query-selected upstream and unknown body fields', async () => {
  const h = harness()
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(h.request(`/api/pharmacy/api/orders/${id}/assign?url=https://evil.example`, { method: 'POST', session: token }), { params: Promise.resolve({ path: ['api', 'orders', id, 'assign'] }) })
  assert.equal(res.status, 404)
  assert.equal((await h.mutate('assign', { body: { url: 'https://evil.example' } })).status, 422)
  assert.equal(h.calls.length, 0)
})

test('logout deletes matching local cookie without backend dependency or token response', async () => {
  const h = harness(); const res = await h.load('app/api/pharmacy/auth/logout/route.ts').POST(h.request('/api/pharmacy/auth/logout', { method: 'POST', session: token }))
  assert.deepEqual(await res.json(), { success: true }); assert.equal(h.calls.length, 0)
  const cookie = res.headers.get('set-cookie')
  for (const attr of ['cil_pharmacy_session=', 'Max-Age=0', 'HttpOnly', 'Secure', 'SameSite=lax', 'Path=/']) assert.ok(cookie.includes(attr), attr)
  assert.ok(!cookie.includes(token)); assert.doesNotMatch(cookie, /Domain=/i)
})

test('reads use staff authentication and redact accidental nested token fields without losing workflow history', async () => {
  const doc = { id, status: 'direct_price_review', directQuote: { totalPrice: 1000 }, winnerTotalPrice: 900, history: [{ reason: 'Original quote', oldValues: { price: 1000 }, newValues: { price: 900 } }], session: token, extra: { token, message: `oops ${token}` } }
  const h = harness({ replies: [response(doc)] })
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').GET(h.request(`/api/pharmacy/api/orders/${id}`, { session: token }), { params: Promise.resolve({ path: ['api', 'orders', id] }) })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, `https://pharmacy-dispatch-api.onrender.com/api/orders/${id}`)
  const out = await res.json()
  assert.deepEqual(out.history, doc.history); assert.deepEqual(out.directQuote, doc.directQuote)
  assert.equal(out.winnerTotalPrice, 900); assert.ok(!JSON.stringify(out).includes(token))
})

test('Generate PA proxies only the signed staff session and returns safe per-line results', async () => {
  const result = { status: 'partial_failure', lines: [{ lineId: 'a', procedureCode: 'DRG-A', amount: 3000, status: 'generated', paNumber: 'PA-1' }], secret: 'must-not-return' }
  const h = harness({ replies: [response(result)] })
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(
    h.request(`/api/pharmacy/api/orders/${id}/generate-pa`, { method: 'POST', session: token, body: { expectedVersion: 4 } }),
    { params: Promise.resolve({ path: ['api', 'orders', id, 'generate-pa'] }) })
  assert.equal(res.status, 200)
  assert.deepEqual(await res.json(), { status: 'partial_failure', lines: result.lines })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, `https://pharmacy-dispatch-api.onrender.com/api/orders/${id}/generate-pa`)
  assert.deepEqual(JSON.parse(h.calls[0].body), { expectedVersion: 4 })
  assert.equal(h.calls[0].headers['X-Service-Key'], undefined)
})

test('Generate PA refuses a missing version before contacting backend', async () => {
  const h = harness()
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(
    h.request(`/api/pharmacy/api/orders/${id}/generate-pa`, { method: 'POST', session: token }),
    { params: Promise.resolve({ path: ['api', 'orders', id, 'generate-pa'] }) })
  assert.equal(res.status, 422)
  assert.equal(h.calls.length, 0)
})

test('Generate PA network failure reports an unknown result', async () => {
  const h = harness({ fetchImpl: () => { throw new Error('timeout') } })
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(
    h.request(`/api/pharmacy/api/orders/${id}/generate-pa`, { method: 'POST', session: token, body: { expectedVersion: 4 } }),
    { params: Promise.resolve({ path: ['api', 'orders', id, 'generate-pa'] }) })
  assert.equal(res.status, 504)
  assert.match((await res.json()).detail, /result may be unknown/)
})

test('PA verification proxy accepts only the explicit recovery fields', async () => {
  const h = harness({ replies: [response({ status: 'partial_failure', line: { lineId: 'a', status: 'failed_retryable' } })] })
  const path = ['api', 'orders', id, 'pa-lines', 'a', 'verify']
  const body = { resolution: 'confirmed_no_pa', evidence: 'Checked intermediary PA register; no matching PA' }
  const res = await h.load('app/api/pharmacy/[...path]/route.ts').POST(
    h.request('/api/pharmacy/' + path.join('/'), { method: 'POST', session: token, body }),
    { params: Promise.resolve({ path }) })
  assert.equal(res.status, 200)
  assert.equal((await res.json()).line.status, 'failed_retryable')
  assert.equal(h.calls[0].headers['X-Service-Key'], undefined)
  const denied = harness()
  const bad = await denied.load('app/api/pharmacy/[...path]/route.ts').POST(
    denied.request('/api/pharmacy/' + path.join('/'), { method: 'POST', session: token, body: { ...body, token: 'bad' } }),
    { params: Promise.resolve({ path }) })
  assert.equal(bad.status, 422)
  assert.equal(denied.calls.length, 0)
})

test('central browser transport uses same-origin, redirects only on 401, and never replays', async () => {
  for (const status of [401, 409, 422, 503]) {
    const navigations = []
    const h = harness({ replies: [response({ detail: 'Synthetic failure' }, status)] })
    const api = h.load('lib/pharmacy-api.ts', { window: { location: { pathname: '/pharmacy', assign: path => navigations.push(path) } } })
    await assert.rejects(api.assignPharmacyOrder(id, id, 7))
    assert.equal(h.calls.length, 1); assert.ok(h.calls[0].url.startsWith('/api/pharmacy/'))
    assert.equal(h.calls[0].headers['X-Service-Key'], undefined)
    assert.deepEqual(navigations, status === 401 ? ['/pharmacy/login'] : [])
  }
})

test('Pharmacy browser source has no secret, token decoding, signing or storage', () => {
  for (const file of ['lib/pharmacy-api.ts', 'app/pharmacy/login/page.tsx', 'components/pharmacy/PharmacySessionBar.tsx']) {
    const source = fs.readFileSync(file, 'utf8')
    assert.doesNotMatch(source, /SESSION_SECRET|localStorage|sessionStorage|atob\(|Buffer\.from|NEXT_PUBLIC_PHARMACY|document\.cookie|console\./)
  }
})

for (const [method, path, body, upstream] of [
  ['GET', ['api', 'orders'], undefined, { orders: [] }],
  ['GET', ['api', 'aggregators'], undefined, []],
  ['POST', ['api', 'orders'], { enrollee: {}, provider: {}, medications: [] }, { success: true, orderId: id }],
  ['PUT', ['api', 'orders', id], { medications: [] }, { success: true }],
]) test(`existing ${method} ${path.join('/')} remains available through staff proxy`, async () => {
  const h = harness({ replies: [response(upstream)] })
  const res = await h.load('app/api/pharmacy/[...path]/route.ts')[method](h.request('/api/pharmacy/' + path.join('/'), { method, session: token, body, headers: { 'X-Service-Key': 'do-not-forward', Authorization: 'do-not-forward' } }), { params: Promise.resolve({ path }) })
  assert.equal(h.calls.length, 1)
  assert.equal(h.calls[0].url, `https://pharmacy-dispatch-api.onrender.com/${path.join('/')}`)
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), upstream)
  assert.equal(h.calls[0].headers['X-Service-Key'], undefined)
  assert.equal(h.calls[0].headers.Authorization, undefined)
  assert.equal(h.calls[0].headers.Cookie, `staff_session=${token}`)
})

test('network outage during mutation preserves cookie and performs no replay', async () => {
  const h = harness({ replies: [new Error('offline')] })
  const res = await h.mutate()
  assert.equal(res.status, 503); assert.equal(res.headers.get('set-cookie'), null); assert.equal(h.calls.length, 1)
})

test('malformed mutation success never becomes successful operation', async () => {
  const h = harness({ replies: [response({ session: token })] })
  const res = await h.mutate()
  assert.equal(res.status, 502); assert.ok(!(await res.text()).includes(token))
})

test('login UI submits once through centralized same-origin client and clears form', async () => {
  let cursor = 0, reset = 0, release
  const state = [], calls = [], navigations = []
  const hooks = {
    useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value }] },
    useRef: initial => { const i = cursor++; return state[i] ??= { current: initial } },
  }
  const api = { loginPharmacyStaff: (...args) => { calls.push(args); return new Promise(resolve => { release = resolve }) } }
  const h = harness()
  const Page = h.load('app/pharmacy/login/page.tsx', {
    require: name => name === 'react' ? hooks : name === '@/lib/pharmacy-api' ? api : require(name),
    FormData: class { get(name) { return loginBody[name] } },
    window: { location: { assign: path => navigations.push(path) } },
  }).default
  const tree = Page(), form = tree.props.children.props.children.find(child => child.type === 'form')
  const event = { preventDefault() {}, currentTarget: { reset: () => reset++ } }
  const first = form.props.onSubmit(event)
  await form.props.onSubmit(event)
  assert.equal(calls.length, 1); assert.equal(reset, 1)
  release({ success: true, user: identity }); await first
  assert.deepEqual(navigations, ['/pharmacy'])
  assert.deepEqual(calls, [[identity.email, loginBody.password]])
})

test('order deletion has no proxy export or allowlisted upstream route', async () => {
  const h = harness()
  const route = h.load('app/api/pharmacy/[...path]/route.ts')
  assert.equal(route.DELETE, undefined)
  const res = await route.POST(h.request(`/api/pharmacy/api/orders/${id}`, { method: 'DELETE', session: token }), { params: Promise.resolve({ path: ['api', 'orders', id] }) })
  assert.equal(res.status, 404)
  assert.equal(h.calls.length, 0)
})
