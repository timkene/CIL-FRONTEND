import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../app/nhia-vetting/claims/page.tsx', import.meta.url), 'utf8')

test('bulk selection uses one server eligibility snapshot beyond the visible page', () => {
  assert.match(source, /\/api\/v1\/nhia\/claims\/eligibility\?\$\{params\}/)
  assert.match(source, /params\.set\('include_claims', 'true'\)/)
  assert.match(source, /data\.claims\.length !== data\.eligibleCount/)
  assert.doesNotMatch(source, /for \([^)]*page[^)]*\).*fetch/s)
})

test('component wires stale-response gates to list, metrics, eligibility, and bulk selection', () => {
  assert.match(source, /claimsRequestGate\.current\.isCurrent/)
  assert.match(source, /metricsRequestGate\.current\.isCurrent/)
  assert.match(source, /eligibilityRequestGate\.current\.isCurrent/)
  assert.match(source, /bulkRequestGate\.current\.isCurrent/)
  assert.match(source, /currentFilterScope\.current !== originFilterScope/)
})

test('filter changes explicitly clear selection and prevent stale payment', () => {
  assert.match(source, /Selection cleared because Claims filters changed/)
  assert.match(source, /selectionFilterScope !== filterScope/)
  assert.match(source, /setSelected\(current => mergeEligibleSelection/)
})

test('batch filtering reaches list, metrics, export, and eligibility queries', () => {
  assert.match(source, /claimsQuery\(decision, search, dateFrom, dateTo, batchId\)/)
  assert.match(source, /Batch Number/)
  assert.match(source, /Select entire batch/)
})

test('selection review and payment confirmation show safe totals and batches', () => {
  assert.match(source, /Review selected claims/)
  assert.match(source, /missingAmountCount/)
  assert.match(source, /ineligible claim\(s\) were excluded/)
  assert.match(source, /Batches:/)
  assert.match(source, /removeSelectedClaim/)
})

test('whole-batch UI confirms the batch-wide snapshot before selection', () => {
  assert.match(source, /setBatchConfirmation\(\{ snapshot: data, batchId, originFilterScope \}\)/)
  assert.match(source, /Select entire batch \{batchConfirmation\.batchId\}\?/)
  assert.match(source, /including claims hidden by your current search, date, or decision filters/)
  assert.match(source, /Your current filters will be ignored for this selection/)
  assert.match(source, /batchConfirmation\.snapshot\.recordedAmount/)
  assert.match(source, /batchConfirmation\.snapshot\.missingAmountCount/)
  assert.match(source, /batchConfirmation\.snapshot\.excludedCount/)
  assert.match(source, /onClick=\{confirmEntireBatch\}/)
  assert.match(source, /onClick=\{cancelEntireBatch\}>Cancel/)
})

test('Pay is blocked while a bulk selection request is unresolved', () => {
  assert.match(source, /if \(bulkSelectingRef\.current\)/)
  assert.match(source, /disabled=\{bulkSelecting \|\| Boolean\(batchConfirmation\)\}/)
})

test('page-only pagination still cannot reload metrics or eligibility', () => {
  const metricsLoader = source.slice(source.indexOf('const loadMetrics'), source.indexOf('const loadEligibility'))
  const eligibilityLoader = source.slice(source.indexOf('const loadEligibility'), source.indexOf('const refreshClaims'))
  assert.doesNotMatch(metricsLoader, /\bpage\b/)
  assert.doesNotMatch(eligibilityLoader, /\bpage\b/)
})
