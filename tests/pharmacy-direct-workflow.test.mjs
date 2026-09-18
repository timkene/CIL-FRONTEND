import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'
const require = createRequire(import.meta.url), ts = require('typescript')
function load(file, overrides = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021, jsx: ts.JsxEmit.ReactJSX } }).outputText, { exports, require, process: { env: {} }, Error, ...overrides })
  return exports
}
const nodes = n => !n || typeof n !== 'object' ? [] : [n, ...[n.props?.children].flat(Infinity).flatMap(nodes)]
const text = n => !n || typeof n === 'boolean' ? '' : typeof n !== 'object' ? String(n) : [n.props?.children].flat(Infinity).map(text).join(' ')
const settle = () => new Promise(r => setImmediate(r))
function harness(status, extra = {}) {
  let cursor = 0, state = [], calls = [], order = { id: 'o', intakeId: 'I', status, assignmentType: 'direct', version: 3, winnerName: 'Pharmacy A', winnerTotalPrice: 950, directQuote: { totalPrice: 1000 }, ...extra }
  const real = load('lib/pharmacy-api.ts')
  const api = { ...real, mutatePharmacyLifecycle: async (...args) => { calls.push(args) } }
  const hooks = { useState: initial => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], v => { state[i] = v }] }, useRef: initial => { const i = cursor++; return state[i] ??= { current: initial } } }
  const mod = load('components/pharmacy/DirectWorkflow.tsx', { window: { confirm: () => true }, require: n => n === 'react' ? hooks : n === '@/lib/pharmacy-api' ? api : n === './ReviewActions' ? { ReviewActions: () => null } : require(n) })
  const render = () => { cursor = 0; return mod.DirectWorkflow({ order, onComplete: async () => { calls.push('refresh'); order = { ...order, version: order.version + 1, status: 'direct_reassignment' } } }) }
  const button = label => nodes(render()).find(n => n.type === 'button' && text(n) === label)
  const input = (type, value) => nodes(render()).find(n => n.type === type).props.onChange({ target: { value } })
  return { render, button, input, calls, api, mod, order }
}
for (const [status, expected] of [['direct_quote_requested', 'Waiting for pharmacy price'], ['direct_price_review', '₦1,000'], ['direct_reassignment', 'no longer active'], ['awaiting_fulfillment', 'Price approved'], ['accepted', 'Accepted by aggregator']]) test(`renders ${status}`, () => {
  const h = harness(status, { priceApprovedAt: '2026-09-01' }); assert.match(text(h.render()), new RegExp(expected));
  if (status === 'direct_quote_requested') { assert.equal(h.button('Approve Price'), undefined); assert.equal(h.button('Deny Price'), undefined) }
})
for (const [status, button, action] of [['direct_price_review', 'Approve Price', 'direct-approve'], ['direct_price_review', 'Adjust Price + Approve', 'direct-approve'], ['direct_price_review', 'Deny Price', 'direct-deny'], ['direct_quote_requested', 'Recall', 'recall'], ['awaiting_fulfillment', 'Recall', 'recall'], ['accepted', 'Recall', 'recall'], ['completed', 'Edit Price', 'adjust-price'], ['completed', 'Cancel Order', 'cancel'], ['completed', 'Recall / Reversal', 'recall']]) test(`${status}: ${button} validates and submits exact version`, async () => {
  const h = harness(status); h.button(button).props.onClick()
  if (button !== 'Approve Price') {
    assert.equal(h.button('Confirm action').props.disabled, true)
    h.input('textarea', '   '); assert.equal(h.button('Confirm action').props.disabled, true)
    h.input('textarea', 'Correction')
  }
  if (['Edit Price', 'Adjust Price + Approve'].includes(button)) {
    for (const price of ['', '0', '-1', 'Infinity', 'oops']) { h.input('input', price); assert.equal(h.button('Confirm action').props.disabled, true) }
    h.input('input', '900')
  }
  h.button('Confirm action').props.onClick(); await settle()
  const body = JSON.parse(JSON.stringify(h.calls[0][1])); assert.equal(body.action, action); assert.equal(body.expectedVersion, 3)
  if (button === 'Adjust Price + Approve') assert.equal(body.adjusted_price, 900)
  if (button === 'Edit Price') assert.equal(body.totalPrice, 900)
  assert.equal(h.calls[1], 'refresh'); assert.match(text(h.render()), /no longer active/)
})
for (const status of ['awaiting_confirmation', 'completed', 'not_received', 'fulfilled']) test(`${status} administration and disabled PA`, () => {
  const h = harness(status, { paGeneration: { available: false, status: 'not_configured' } }); for (const b of ['Edit Price', 'Cancel Order', 'Recall / Reversal']) assert.ok(h.button(b)); assert.equal(h.button('Generate PA').props.disabled, true)
})
for (const status of ['cancelled', 'post_fulfilment_recalled']) test(`${status} preserves fulfilment without operations`, () => {
  const h = harness(status, { fulfillmentType: 'delivered', fulfilledAt: '2026-09-01' }); assert.match(text(h.render()), /delivered/); for (const b of ['Edit Price', 'Cancel Order', 'Recall', 'Recall / Reversal']) assert.equal(h.button(b), undefined)
})
test('competitive states are not direct; legacy remains readable', () => {
  for (const status of ['bidding', 'clearline_price_review', 'awaiting_fulfillment', 'accepted']) { const h = harness(status, { assignmentType: undefined }); assert.equal(h.render(), null) }
  const h = harness('completed', { version: undefined, history: undefined, directQuote: undefined, paGeneration: undefined }); assert.ok(h.render()); assert.match(text(h.mod.OrderHistory({ order: h.order })), /No history/)
})
test('history presents attempts, quote, actor, reason and price changes', () => {
  const h = harness('completed'); const history = ['direct_assigned', 'direct_quote_submitted', 'price_adjusted', 'direct_quote_denied', 'direct_recalled', 'direct_reassigned', 'aggregator_accepted', 'fulfilled', 'cancelled', 'post_fulfilment_recalled'].map(eventType => ({ eventType, actorName: 'Staff', reason: 'Correction', assignmentVersion: 2, oldValues: { winnerTotalPrice: 1000 }, newValues: { winnerTotalPrice: 900 } }))
  const out = text(h.mod.OrderHistory({ order: { history } })); for (const t of ['direct assigned', 'quote submitted', 'Staff', 'Correction', 'attempt 2', '₦1,000', '₦900', 'post fulfilment recalled']) assert.ok(out.replace(/\s+/g, ' ').includes(t), t)
})
test('409 refreshes once without replay; duplicate clicks prevented', async () => {
  const h = harness('direct_price_review'); let reject
  h.api.mutatePharmacyLifecycle = async () => { h.calls.push('mutation'); return new Promise((_, r) => { reject = r }) }
  h.button('Approve Price').props.onClick(); const confirm = h.button('Confirm action'); confirm.props.onClick(); confirm.props.onClick(); assert.deepEqual(h.calls, ['mutation'])
  reject(new h.api.PharmacyApiError(409, 'stale')); await settle(); assert.deepEqual(h.calls, ['mutation', 'refresh']); assert.match(text(h.render()), /updated by someone else/)
})
test('API sends exact bodies and cookies; rejects invalid inputs without requests', async () => {
  const calls = []; const api = load('lib/pharmacy-api.ts', { fetch: async (url, init) => { calls.push({ url, ...init }); return { ok: true, json: async () => ({}) } } })
  await api.assignPharmacyOrder('o', 'a', 7); assert.deepEqual(JSON.parse(calls[0].body), { aggregatorId: 'a', expectedVersion: 7 })
  for (const action of ['direct-approve', 'direct-deny', 'recall', 'adjust-price', 'cancel']) {
    const req = { action, expectedVersion: 8, ...(action !== 'direct-approve' ? { reason: ' Reason ' } : {}), ...(action === 'adjust-price' ? { totalPrice: 1200 } : {}) }; await api.mutatePharmacyLifecycle('o', req)
    const call = calls.at(-1); assert.ok(call.url.endsWith('/' + action)); assert.equal(call.credentials, 'include'); assert.equal(JSON.parse(call.body).expectedVersion, 8); assert.equal(JSON.parse(call.body).action, undefined)
  }
  const before = calls.length
  await assert.rejects(api.mutatePharmacyLifecycle('o', { action: 'cancel', expectedVersion: 8, reason: ' ' }))
  await assert.rejects(api.mutatePharmacyLifecycle('o', { action: 'direct-approve', expectedVersion: 8, adjusted_price: Infinity, reason: 'x' }))
  assert.equal(calls.length, before)
})


test('live version change closes an old confirmation without mutation', async () => {
  const h = harness('direct_price_review')
  h.button('Approve Price').props.onClick()
  h.order.version = 4
  h.button('Confirm action').props.onClick()
  await settle()
  assert.deepEqual(h.calls, [])
  assert.match(text(h.render()), /updated by someone else/)
})

test('competitive price review retains approval API and refresh', async () => {
  const calls = [], order = { id: 'o', intakeId: 'I', status: 'clearline_price_review', assignmentType: 'competitive', winnerName: 'Winner', winnerTotalPrice: 1000, enrollee: { fullName: 'Synthetic' }, medications: [], bids: [] }
  let cursor = 0
  const state = [order, [], order.status, false, null, false, false, false, '900']
  const hooks = { useState: initial => { const i = cursor++; return [i in state ? state[i] : initial, v => { state[i] = v }] }, useEffect() {}, useCallback: fn => fn, useRef: v => ({ current: v }) }
  const api = { getPharmacyOrder: async () => { calls.push('refresh'); return order }, clearlineApprovePharmacyOrder: async (...args) => calls.push(args), PharmacyApiError: Error }
  const mod = load('app/pharmacy/orders/[id]/page.tsx', { window: { confirm: () => true }, require: n => n === 'react' ? hooks : n === 'next/navigation' ? { useParams: () => ({ id: 'o' }) } : n === 'next/link' ? { default: () => null } : n === '@/lib/pharmacy-api' ? api : n.endsWith('DirectWorkflow') ? { isDirectOrder: () => false } : n.startsWith('@/components/') ? {} : require(n) })
  const tree = mod.default(); assert.ok(nodes(tree).some(n => n.props?.label === 'Clearline Price Review'))
  const approve = nodes(tree).find(n => n.type === 'button' && text(n).includes('Approve & Notify Aggregator'))
  assert.ok(approve); await approve.props.onClick()
  assert.deepEqual(calls, [['o', 900], 'refresh'])
})
