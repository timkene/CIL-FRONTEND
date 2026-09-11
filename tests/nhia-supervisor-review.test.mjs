import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
let ts
try {
  ts = require('typescript')
} catch {
  ts = require(path.join(__dirname, '../../../frontend/node_modules/typescript'))
}

function load() {
  const source = fs.readFileSync(path.join(__dirname, '../lib/nhia-supervisor-review.ts'), 'utf8')
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText
  const exports = {}
  vm.runInNewContext(compiled, { exports })
  return exports
}

const empty = {
  overrides: {},
  qtyEdits: {},
  priceEdits: {},
  overrideReasons: {},
  notes: '',
  reviewer: 'Supervisor',
}

test('summary-only batches have no review line items', () => {
  const { hasReviewLineItems } = load()
  assert.equal(hasReviewLineItems({}), false)
  assert.equal(hasReviewLineItems({ vetting_results: null }), false)
  assert.equal(hasReviewLineItems({ vetting_results: [] }), false)
})

test('detailed review payload exposes line items', () => {
  const { hasReviewLineItems } = load()
  assert.equal(hasReviewLineItems({
    vetting_results: [{ line_items: [{ request_id: 'req-1' }] }],
  }), true)
})

test('unsaved quantity and status edits are dirty until saved', () => {
  const { reviewSnapshot, reviewIsDirty } = load()
  const saved = reviewSnapshot(empty)
  assert.equal(reviewIsDirty(empty, saved), false)
  assert.equal(reviewIsDirty({ ...empty, qtyEdits: { 'req-1': 2 } }, saved), true)
  assert.equal(reviewIsDirty({ ...empty, overrides: { 'req-1': 'DENY' } }, saved), true)
})

test('supervisor review header is distinct from ordinary nhia fetches', () => {
  const { supervisorReviewHeaders, SUPERVISOR_REVIEW_HEADER } = load()
  const headers = supervisorReviewHeaders({ 'Content-Type': 'application/json' })
  assert.equal(headers[SUPERVISOR_REVIEW_HEADER], '1')
  assert.equal(headers['Content-Type'], 'application/json')
})
