import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function load(path) {
  const source = ts.transpileModule(fs.readFileSync(path, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports, module: { exports }, require, fetch: globalThis.fetch, process, URL, AbortSignal, console })
  return exports
}

const tools = load('lib/analyst-tools.ts')

test('rejects unknown tools', async () => {
  await assert.rejects(() => tools.runAnalystTool('drop_database', {}), /unknown tool/i)
})

test('search_companies calls /groups with the company name', async () => {
  const calls = []
  const result = await tools.runAnalystTool(
    'search_companies',
    { search: 'AIR PEACE' },
    {
      async medicloud(path, init) {
        calls.push({ path, init })
        return { total: 1, results: [{ group_id: 1706, group_name: 'AIR PEACE NIGERIA' }] }
      },
    },
  )
  assert.equal(calls[0].path.startsWith('/groups?'), true)
  assert.match(calls[0].path, /search=AIR(\+|%20)PEACE/)
  assert.equal(result.results[0].group_id, 1706)
})

test('medical_cost posts utilization summary only', async () => {
  const calls = []
  await tools.runAnalystTool(
    'medical_cost',
    { group_id: 942, start_date: '2026-01-01', end_date: '2026-11-10' },
    {
      async medicloud(path, init) {
        calls.push({ path, init })
        return { summary: { total_medical_cost: 1 } }
      },
    },
  )
  assert.equal(calls[0].path, '/client-utilization')
  assert.equal(calls[0].init.method, 'POST')
  const body = JSON.parse(calls[0].init.body)
  assert.equal(body.group_id, 942)
  assert.equal(body.start_date, '2026-01-01')
})

test('active_lives returns totals without enrollee rows', async () => {
  const result = await tools.runAnalystTool(
    'active_lives',
    { group_id: 1706 },
    {
      async medicloud() {
        return {
          group: { group_id: 1706, group_name: 'AIR PEACE NIGERIA' },
          total: 1700,
          results: [{ enrollee_id: 'CL/X', full_name: 'Secret Person' }],
        }
      },
    },
  )
  assert.equal(result.total, 1700)
  assert.equal(result.results, undefined)
  assert.equal(JSON.stringify(result).includes('Secret Person'), false)
})

test('collections slims cash and debit rows', async () => {
  const result = await tools.runAnalystTool(
    'collections',
    { company_name: 'AIR PEACE', from_date: '2026-01-01', to_date: '2026-11-11' },
    {
      async medicloud(path) {
        assert.match(path, /\/collections\?/)
        assert.match(path, /company_name=AIR/)
        return {
          query: { company_name: 'AIR PEACE' },
          cash_received: { total_amount: 9, items: Array.from({ length: 25 }, (_, i) => ({ i })) },
          debit_notes: { total_amount: 3, items: [{ i: 1 }] },
        }
      },
    },
  )
  assert.equal(result.cash_received.items.length, 20)
  assert.equal(result.debit_notes.items.length, 1)
  assert.equal(result.cash_received.total_amount, 9)
})

test('group_plans keeps census fields only', async () => {
  const result = await tools.runAnalystTool(
    'group_plans',
    { group_id: 1706 },
    {
      async medicloud(path) {
        assert.match(path, /\/group-plans\?/)
        return {
          total: 2,
          results: [
            { plan_id: 2939, plan_name: 'APN BRONZE 25', enrollee_count: 735, extra: 'drop' },
            { plan_id: 2941, plan_name: 'APN SILVER 25', enrollee_count: 85 },
          ],
        }
      },
    },
  )
  assert.equal(result.results[0].enrollee_count, 735)
  assert.equal(result.results[0].extra, undefined)
})

test('LLM uses Vercel AI Gateway, not a direct OpenAI key', () => {
  const llm = load('lib/analyst-llm.ts')
  const resolved = llm.resolveAnalystLlm({ AI_GATEWAY_API_KEY: 'gw_test', ANALYST_MODEL: '' })
  assert.equal(resolved.url, 'https://ai-gateway.vercel.sh/v1/chat/completions')
  assert.equal(resolved.model, 'openai/gpt-4.1-mini')
  assert.equal(resolved.apiKey, 'gw_test')
  assert.throws(
    () => llm.resolveAnalystLlm({ OPENAI_API_KEY: 'sk-should-not-be-enough' }),
    /AI Gateway is not configured/,
  )
})

test('auth lists Analyst chat for MLR users', () => {
  const auth = load('lib/auth.ts')
  const route = auth.MODULE_ROUTES.find((item) => item.href === '/analyst')
  assert.equal(route.label, 'Analyst')
  assert.equal(route.module, 'MLR Data')
  const mlrUser = { modules: ['MLR Data'] }
  assert.equal(auth.hasModuleAccess(mlrUser, 'MLR Data'), true)
})
