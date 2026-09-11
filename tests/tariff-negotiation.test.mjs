import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
const require = createRequire(import.meta.url)
const ts = require('typescript')
function load(file) {
  const source = fs.readFileSync(new URL(file, import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, require })
  return exports
}
const { canTargetBand } = load('../lib/tariff-negotiation.ts')
const { NegotiationPlan } = load('../app/tariff/NegotiationPlan.tsx')
const { renderToStaticMarkup } = require('react-dom/server')
const { createElement } = require('react')
test('only strictly cheaper D/C/B/A targets are allowed', () => {
  const bands = ['D', 'C', 'B', 'A', 'Special']
  for (const [rank, current] of bands.entries()) {
    for (const [targetRank, target] of bands.entries()) {
      assert.equal(canTargetBand(current, false, target), targetRank < rank && target !== 'Special')
    }
  }
  for (const current of ['UNBANDABLE', undefined, null, 'unknown', 'toString']) assert.equal(canTargetBand(current, false, 'D'), false)
  assert.equal(canTargetBand('A', true, 'C'), false)
  assert.equal(canTargetBand('A', false, ''), false)
})
const fixture = {
  current_relative_band: 'A', current_index: 1.33, target_relative_band: 'C', target_index: 1,
  projected_relative_band: 'C', projected_index: 0.99, feasible: true, exception: false,
  selected_line_count: 1, total_core_candidate_count: 2, weighted_coverage: 0.9, raw_coverage: 0.8,
  index_reduction: 0.34, remaining_index_gap: 0, message: 'Target reached',
  offers: [{ procedure_code: 'TEST1', current_hospital_price: 1000, proposed_price: 900, reduction_percent: 10, is_final_partial_line: true, reason_selected: 'final_partial_to_hit_target' }],
  unselected: [{ procedure_code: 'TEST2', proposed_price: null, reason: 'not_required_after_target_reached' }],
  excluded_codes: [{ procedure_code: 'EXCLUDED' }], duplicate_codes: [{ procedure_code: 'DUPE', conflict: true, prices: [100, 200] }],
  non_core_lines: [{ procedure_code: 'APPENDIX', hospital_price: 500, affects_official_band: false }],
}
const render = overrides => renderToStaticMarkup(createElement(NegotiationPlan, { plan: { ...fixture, ...overrides } }))
test('renders projections, actual percentage units, partial line and separate appendices', () => {
  const html = render({})
  for (const text of ['Current: Relative Band A — 1.33', 'If proposed prices are accepted: Relative Band C — 0.99', '₦1,000.00', '10.0%', 'Final partially reduced line', 'Unselected reducible lines', 'EXCLUDED', 'Conflict: ₦100.00, ₦200.00', 'APPENDIX', 'Offers are not sent automatically.']) assert.ok(html.includes(text), text)
  assert.ok(!html.includes('1,000.0%'))
})
test('successful plan shows invalid candidate floors separately from proposed offers', () => {
  const html = render({ ineligible: [{
    procedure_code: 'CONS000', current_hospital_price: 1200,
    raw_candidate_floor: 0.004, candidate_floor: 0,
    effective_reference: 800, target_ladder_price: 700,
    reason: 'invalid_candidate_floor',
  }] })
  assert.ok(html.includes('Target reached'))
  const details = html.match(/<details><summary[^>]*>Invalid candidate floors \(1\)<\/summary>([\s\S]*?)<\/details>/)?.[1]
  assert.ok(details, 'invalid floor details remain visible on a successful plan')
  for (const text of ['CONS000', '₦1,200.00', '0.004', '₦0.00', '₦800.00', '₦700.00', 'invalid candidate floor', 'These lines are not offers and do not contribute to the official target.']) assert.ok(details.includes(text), text)
  const offers = html.match(/<h3[^>]*>Proposed offers<\/h3>([\s\S]*?)<details>/)?.[1]
  assert.ok(offers?.includes('TEST1'))
  assert.ok(!offers.includes('CONS000'))
  assert.ok(!details.includes('Proposed'))
  assert.ok(!html.includes('₦0.01'))
})
test('infeasible plan shows backend best achievable band and gap', () => {
  const html = render({ feasible: false, projected_relative_band: 'B', projected_index: 1.08, remaining_index_gap: 0.08 })
  assert.ok(html.includes('Target C cannot be reached'))
  assert.ok(html.includes('Best achievable: Band B, index 1.08'))
  assert.ok(html.includes('Remaining index gap: 0.0800'))
})
test('exception response does not present offers or a misleading projection', () => {
  const html = render({ exception: true })
  assert.ok(html.includes('Negotiation needs a bandable official result'))
  assert.ok(!html.includes('If proposed prices are accepted'))
  assert.ok(!html.includes('TEST1'))
})

test('negotiation page calls the tariff backend directly with no client abort', () => {
  const source = fs.readFileSync(new URL('../app/tariff/page.tsx', import.meta.url), 'utf8')
  assert.equal(source.includes('AbortSignal'), false)
  assert.equal(/\btimeout\s*:/.test(source), false)
  assert.ok(source.includes('`${API}/api/v1/tariff-banding/negotiate-v2`'))
  assert.ok(source.includes('`${API}/api/v1/tariff-banding/analyze`'))
  assert.equal(source.includes("fetch('/api/v1/tariff-banding/negotiate-v2'"), false)
  assert.equal(source.includes('/api/v1/tariff-banding/negotiate`'), false)
  assert.ok(source.includes('disabled={busy || !canTargetBand'))
  assert.ok(source.includes('Generating negotiation plan. A full-core request can take about a minute.'))
})

test('V2 proxy forwards target body and upstream errors without contacting a service', async () => {
  const source = fs.readFileSync(new URL('../app/api/v1/tariff-banding/negotiate-v2/route.ts', import.meta.url), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText
  const exports = {}
  let fail = false
  let captured
  vm.runInNewContext(compiled, {
    exports, require,
    process: { env: { TARIFF_API_URL: 'http://fixture.invalid/' } },
    fetch: async (url, options) => {
      captured = { url, options }
      if (fail) throw new Error('offline')
      return new Response('{"detail":"invalid target"}', { status: 422, headers: { 'content-type': 'application/json' } })
    },
  })
  const body = JSON.stringify({ provider_id: 'fixture', current_band: 'A', target_relative_band: 'C' })
  const response = await exports.POST(new Request('http://localhost', { method: 'POST', body }))
  assert.equal(captured.url, 'http://fixture.invalid/api/v1/tariff-banding/negotiate-v2')
  assert.equal(captured.options.body, body)
  assert.equal(captured.options.cache, 'no-store')
  assert.equal(captured.options.signal, undefined)
  assert.equal(exports.maxDuration, undefined)
  assert.equal(response.status, 422)
  assert.deepEqual(await response.json(), { detail: 'invalid target' })
  fail = true
  const unavailable = await exports.POST(new Request('http://localhost', { method: 'POST', body }))
  assert.equal(unavailable.status, 502)
})
