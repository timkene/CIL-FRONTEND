import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
let ts, dependency
try { ts = require('typescript'); dependency = require } catch {
  dependency = createRequire(new URL('../../../frontend/package.json', import.meta.url))
  ts = dependency('typescript')
}
function load(file, globals = {}) {
  const source = fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, Error, require: dependency, process: { env: {} }, ...globals })
  return exports
}

test('review API uses required comment and exact aggregator contract', async () => {
  const calls = []
  const api = load('lib/pharmacy-api.ts', { fetch: async (url, init) => { calls.push({ url, ...init }); return { ok: true, json: async () => [] } } })
  await assert.rejects(api.rejectPharmacyOrder('order-1', '  '), /required/)
  assert.equal(calls.length, 0)
  await api.rejectPharmacyOrder('order-1', '  Needs review  ')
  assert.equal(calls[0].url.endsWith('/api/orders/order-1/reject'), true)
  assert.equal(calls[0].method, 'POST')
  assert.deepEqual(JSON.parse(calls[0].body), { comment: 'Needs review' })
  await api.listPharmacyAggregators()
  assert.equal(calls[1].url.endsWith('/api/aggregators'), true)
  const wrapped = load('lib/pharmacy-api.ts', { fetch: async () => ({ ok: true, json: async () => ({ aggregators: [{ id: 'a1', companyName: 'A', contactName: 'C', email: 'e' }] }) }) })
  const wrappedList = await wrapped.listPharmacyAggregators()
  assert.equal(wrappedList[0].id, 'a1')
  assert.equal(wrappedList[0].companyName, 'A')
  const invalid = load('lib/pharmacy-api.ts', { fetch: async () => ({ ok: true, json: async () => ({}) }) })
  const invalidList = await invalid.listPharmacyAggregators()
  assert.equal(invalidList.length, 0)
  await api.assignPharmacyOrder('order-1', 'aggregator-2')
  assert.equal(calls[2].url.endsWith('/api/orders/order-1/assign'), true)
  assert.equal(calls[2].method, 'POST')
  assert.deepEqual(JSON.parse(calls[2].body), { aggregatorId: 'aggregator-2' })
  await api.approvePharmacyOrder('order-1')
  assert.equal(calls[3].body, undefined)
})

const snapshot = {
  checked_at: '2026-09-14T09:00:00Z', request_date: '2026-09-14', codes: [],
  enrollee_status: { isterminated: false, terminationDate: null, flagged: false },
  medication_benefit: { limit_amount: 1000, utilized_amount: 1000, remaining_amount: 0, benefit_name: 'Medication', flagged: false },
  recent_medication: { from_date: '2026-08-24', to_date: '2026-09-14', flagged: false, items: [] },
}
const { renderToStaticMarkup } = dependency('react-dom/server')
const { ReviewFlagsPanel } = load('components/pharmacy/ReviewFlagsPanel.tsx')
const render = flags => renderToStaticMarkup(ReviewFlagsPanel({ flags }))

test('snapshot distinguishes no flags, missing snapshot, zero benefit and failed checks', () => {
  assert.match(render(undefined), /snapshot unavailable/)
  assert.doesNotMatch(render(undefined), /No review flags/)
  const html = render(snapshot)
  assert.match(html, /No review flags/)
  assert.match(html, /Remaining: ₦0/)
  assert.match(html, /2026-09-14T09:00:00Z/)
  assert.match(html, /staff decide/)
  const failed = render({ ...snapshot, recent_medication: { ...snapshot.recent_medication, error: 'Lookup failed' } })
  assert.match(failed, /History check incomplete: Lookup failed/)
  assert.doesNotMatch(failed, /No medication history recorded/)
})

test('all flags, unknown codes and history details remain visible', () => {
  const html = render({ ...snapshot, codes: ['ENROLLEE_TERMINATED', 'FUTURE_FLAG'],
    medication_benefit: { ...snapshot.medication_benefit, flagged: true },
    recent_medication: { ...snapshot.recent_medication, flagged: true, items: [{ date: '2026-09-01', procedure_code: 'RX1', description: 'Sample medication', provider: 'Sample pharmacy', amount: 50 }] },
  })
  for (const text of ['ENROLLEE TERMINATED', 'LOW MEDICATION BENEFIT', 'MEDICATION USED WITHIN LAST 21 DAYS', 'FUTURE_FLAG', 'RX1', 'Sample medication', 'Sample pharmacy', '₦50']) assert.ok(html.includes(text), text)
})

function actionsHarness(overrides = {}) {
  let cursor = 0
  const state = []
  const calls = []
  const api = Object.fromEntries(['approvePharmacyOrder', 'rejectPharmacyOrder', 'assignPharmacyOrder'].map(name => [name, async (...args) => { calls.push([name, ...args]) }]))
  api.pharmacyMutationError = async err => err.message
  api.listPharmacyAggregators = async () => [{ id: 'a1', companyName: 'Sample aggregator', contactName: 'Contact', email: 'sample@example.test' }]
  const hooks = {
    useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = value }] },
    useRef(initial) { const i = cursor++; return state[i] ??= { current: initial } },
  }
  const window = { prompt: () => null, confirm: () => false, ...overrides }
  const { ReviewActions } = load('components/pharmacy/ReviewActions.tsx', { window, require: name => name === 'react' ? hooks : name === '@/lib/pharmacy-api' ? api : dependency(name) })
  function render(status = 'pending_review', version = 0) { cursor = 0; return ReviewActions({ order: { id: 'o1', intakeId: 'I1', status, version }, onComplete: async () => calls.push(['reload']) }) }
  function nodes(node) { return !node || typeof node !== 'object' ? [] : [node, ...[node.props?.children].flat(Infinity).flatMap(nodes)] }
  const button = (tree, label) => nodes(tree).find(n => n.type === 'button' && n.props.children === label)
  return { render, button, nodes, calls, window, api }
}
const settle = () => new Promise(resolve => setImmediate(resolve))

test('denial cancels or blocks blank comments, sends valid comment and refreshes', async () => {
  const h = actionsHarness()
  h.button(h.render(), 'Deny').props.onClick()
  assert.deepEqual(h.calls, [])
  h.window.prompt = () => '  '
  h.button(h.render(), 'Deny').props.onClick()
  assert.deepEqual(h.calls, [])
  assert.ok(h.nodes(h.render()).some(n => n.props?.role === 'alert'))
  h.window.prompt = () => 'Needs clarification'
  h.button(h.render(), 'Deny').props.onClick()
  await settle()
  assert.deepEqual(h.calls, [['rejectPharmacyOrder', 'o1', 'Needs clarification'], ['reload']])
  assert.equal(h.render(), null)
})

test('direct assignment requires selection and confirmation; approve only exists for pending orders', async () => {
  const h = actionsHarness()
  assert.equal(h.render('rejected'), null)
  h.button(h.render(), 'Send directly').props.onClick()
  await settle()
  assert.equal(h.button(h.render(), 'Confirm send').props.disabled, true)
  h.nodes(h.render()).find(n => n.type === 'select').props.onChange({ target: { value: 'a1' } })
  h.button(h.render(), 'Confirm send').props.onClick()
  assert.deepEqual(h.calls, [])
  h.window.confirm = () => true
  h.button(h.render(), 'Confirm send').props.onClick()
  await settle()
  assert.deepEqual(h.calls, [['assignPharmacyOrder', 'o1', 'a1', 0], ['reload']])
  const approve = actionsHarness()
  approve.button(approve.render(), 'Approve').props.onClick()
  await settle()
  assert.deepEqual(approve.calls, [['approvePharmacyOrder', 'o1'], ['reload']])
})

test('failed actions show errors and remain retryable', async () => {
  const h = actionsHarness()
  h.api.approvePharmacyOrder = async () => { throw new Error('Request failed') }
  h.button(h.render(), 'Approve').props.onClick()
  await settle()
  assert.ok(h.nodes(h.render()).some(n => n.props?.role === 'alert' && n.props.children === 'Request failed'))
  assert.equal(h.button(h.render(), 'Approve').props.disabled, false)
  assert.deepEqual(h.calls, [])
})


test('reassignment selector sends the refreshed order version and no competitive approval', async () => {
  const h = actionsHarness({ confirm: () => true })
  assert.equal(h.button(h.render('direct_reassignment', 9), 'Approve'), undefined)
  h.button(h.render('direct_reassignment', 9), 'Send directly').props.onClick()
  await settle()
  h.nodes(h.render('direct_reassignment', 9)).find(n => n.type === 'select').props.onChange({ target: { value: 'a1' } })
  h.button(h.render('direct_reassignment', 10), 'Confirm send').props.onClick()
  await settle()
  assert.deepEqual(h.calls, [['assignPharmacyOrder', 'o1', 'a1', 10], ['reload']])
})
