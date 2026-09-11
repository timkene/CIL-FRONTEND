// Run: node --test tests/tariff-banding-copy.test.mjs
// Compile the standalone copy helper in memory without mounting React.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import vm from 'node:vm'

const require = createRequire(import.meta.url)
let ts
try {
  ts = require('typescript')
} catch (error) {
  if (error.code !== 'MODULE_NOT_FOUND') throw error
  ts = require(path.join(import.meta.dirname, '../../../frontend/node_modules/typescript'))
}
const source = fs.readFileSync(new URL('../lib/tariff-banding-copy.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText
const exports = {}
vm.runInNewContext(compiled, { exports })
const { tariffBandingCopy } = exports

test('official result is labeled Official Relative Band', () => {
  assert.equal(tariffBandingCopy({ relative_band: 'A' }).officialLabel, 'Official Relative Band')
})

test('sensitivity is labeled Sensitivity Check', () => {
  assert.equal(tariffBandingCopy({}).sensitivityLabel, 'Sensitivity Check')
})

test('diagnostic explanation is always included', () => {
  for (const result of [null, undefined, {}, { sensitivity_band: 'A' }, { sensitivity_band: 'UNBANDABLE' }]) {
    assert.equal(tariffBandingCopy(result).diagnosticNote, 'Diagnostic only — this does not change the official band.')
  }
})

test('unbandable sensitivity explicitly preserves the official relative band', () => {
  const copy = tariffBandingCopy({ sensitivity_band: 'UNBANDABLE', relative_band: 'A', tariff_band: 'B' })
  assert.equal(copy.unbandableNote, 'Sensitivity becomes unbandable after removing the largest contributor. Official band remains A.')
})

test('unbandable sensitivity falls back to tariff_band when relative_band is nullish', () => {
  for (const relative_band of [null, undefined]) {
    assert.equal(
      tariffBandingCopy({ sensitivity_band: 'UNBANDABLE', relative_band, tariff_band: 'B' }).unbandableNote,
      'Sensitivity becomes unbandable after removing the largest contributor. Official band remains B.',
    )
  }
})

test('other sensitivity results omit the unbandable sentence', () => {
  for (const sensitivity_band of ['A', 'B', 'C', 'D', 'Special', '', null, undefined]) {
    assert.equal(tariffBandingCopy({ sensitivity_band, relative_band: 'A' }).unbandableNote, null)
  }
})
