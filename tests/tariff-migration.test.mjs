// Run: node --test tests/tariff-migration.test.mjs
// Compile the standalone helper in memory; all HTTP calls are mocked.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'
import ts from 'typescript'
const __dirname = path.dirname(fileURLToPath(import.meta.url))

function load(fetch = () => { throw new Error('Unexpected HTTP request') }) {
  const source = fs.readFileSync(path.join(__dirname, '../lib/tariff-migration.ts'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports, fetch, process: { env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:8000/' } } })
  return exports
}

test('original values retain whitespace, lexical prices, formulas, zero and false', () => {
  const { originalValue } = load()
  for (const text of ['  001,200.00  ', '=SUM(A1:A2)', 'Item\n second line', '']) assert.equal(originalValue(text), text)
  assert.equal(originalValue(0), '0')
  assert.equal(originalValue(false), 'false')
  assert.equal(originalValue(null), '')
})

test('reviewer uses trimmed staff name, then email, and never invents identity', () => {
  const { reviewerName } = load()
  assert.equal(reviewerName({ first_name: ' Ada ', last_name: ' Obi ' }), 'Ada Obi')
  assert.equal(reviewerName({ first_name: ' ', email: ' ada@example.test ' }), 'ada@example.test')
  assert.equal(reviewerName(null), '')
  assert.equal(reviewerName({ email: ' ' }), '')
})

test('changed code cannot inherit the old candidate name or confidence', () => {
  const { suggestion } = load()
  const old = { procedure_code: 'SYN-OLD', procedure_name: 'Original', score: 99, source: 'exact' }
  const changed = { procedure_code: 'SYN-NEW', procedure_name: 'Replacement', score: null }
  const row = { procedure_code: 'SYN-NEW', candidates: [old] }
  assert.equal(suggestion(row, {}), undefined)
  assert.equal(suggestion(row, { 'SYN-NEW': changed }), changed)
  assert.equal(suggestion({ ...row, procedure_code: null }, {}), old)
  assert.equal(suggestion({ ...row, procedure_code: 'SYN-OLD' }, {}), old)
})

test('structured finalization conflict explains remaining reviews', async () => {
  const api = load(async () => new Response(JSON.stringify({ detail: { message: 'Human completion required', remaining: 3 } }), { status: 409 }))
  await assert.rejects(api.migrationJson('/batch/finalize', api.post()), /3 item\(s\).*human completion/)
})

test('validation details and non-JSON service failures are readable', async () => {
  const { errorMessage } = load()
  assert.equal(errorMessage({ detail: [{ msg: 'Select a valid code' }] }, 422), 'Select a valid code')
  const api = load(async () => new Response('<html>Unavailable</html>', { status: 502 }))
  await assert.rejects(api.migrationJson('/batch/status'), /Request failed \(502\)/)
})

test('multipart upload uses correct prefix and leaves boundary to fetch', async () => {
  const form = new FormData()
  form.append('file', new Blob(['Item,Price\nConsult,001.00']), 'tariff.csv')
  const api = load(async (url, options) => {
    assert.equal(url, 'http://127.0.0.1:8000/api/v1/tariff-migration/upload')
    assert.equal(options.method, 'POST')
    assert.equal(options.headers, undefined)
    assert.equal(options.body, form)
    assert.equal(options.cache, 'no-store')
    return Response.json({ batch_id: 'synthetic' })
  })
  assert.equal((await api.migrationJson('/upload', { method: 'POST', body: form })).batch_id, 'synthetic')
})

test('decision payload keeps who and explicit code; start sends no invented body', async () => {
  const api = load(async (url, options) => {
    assert.equal(url.endsWith('/b/rows/7/change'), true)
    assert.deepEqual(JSON.parse(options.body), { who: 'Ada Obi', procedure_code: 'SYN-NEW' })
    assert.equal(options.headers['Content-Type'], 'application/json')
    return Response.json({ status: 'CHANGED' })
  })
  await api.migrationJson('/b/rows/7/change', api.post({ who: 'Ada Obi', procedure_code: 'SYN-NEW' }))
  assert.equal(api.post().body, undefined)
})

test('export remains CSV bytes instead of JSON or reformatted prices', async () => {
  const csv = 'procedure_code,procedure_name,hospital_price,original_hospital_item\r\nSYN-1,Consult,001.00,  Consult  \r\n'
  const api = load(async () => new Response(csv, { headers: { 'Content-Type': 'text/csv' } }))
  assert.equal(await (await api.migrationRequest('/b/export')).text(), csv)
})
