import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'

const source = await readFile(new URL('../app/nhia-vetting/claims/page.tsx', import.meta.url), 'utf8')

test('Claims page renders all six backend scorecards', () => {
  for (const label of ['Total Approved', 'Paid', 'Outstanding to Pay', 'Denied',
    'Approved Claims', 'Payment Progress']) {
    assert.match(source, new RegExp(`label="${label}"`))
  }
})

test('scorecards request backend metrics with the same filters and never sum visible rows', () => {
  assert.match(source, /claimsQuery\(decision, search, dateFrom, dateTo\)/)
  assert.match(source, /\/api\/v1\/nhia\/claims\/metrics\?\$\{params\}/)
  assert.doesNotMatch(source, /claims\.(reduce|filter)\([^\n]*totalApprovedAmount/)
})

test('page-only pagination reloads the list without reloading metrics', () => {
  const listLoader = source.slice(source.indexOf('const loadClaims'), source.indexOf('const loadMetrics'))
  const metricsLoader = source.slice(source.indexOf('const loadMetrics'), source.indexOf('const refreshClaims'))
  assert.match(listLoader, /page\]\)/)
  assert.doesNotMatch(metricsLoader, /\bpage\b/)
  assert.match(source, /useEffect\(\(\) => \{ void loadClaims\(\) \}, \[loadClaims\]\)/)
  assert.match(source, /useEffect\(\(\) => \{ void loadMetrics\(\) \}, \[loadMetrics\]\)/)
})

test('financial scorecards expose incomplete and ambiguous data', () => {
  assert.match(source, /Recorded amount — incomplete data/)
  assert.match(source, /ambiguousPaymentCount/)
  assert.match(source, /ambiguousPaymentAmount/)
  assert.match(source, /Recorded\/requested amount —/)
  assert.match(source, /deniedLinesWithRecordedAmountCount/)
})
