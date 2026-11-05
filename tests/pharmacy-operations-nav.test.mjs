import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function loadAuth() {
  const source = ts.transpileModule(fs.readFileSync('lib/auth.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  }).outputText
  const exports = {}
  vm.runInNewContext(source, { exports })
  return exports
}

const auth = loadAuth()
const pharmacyUser = { modules: ['Pharmacy'] }

test('Pharmacy navigation has separate requests and operations entries', () => {
  const requests = auth.MODULE_ROUTES.find(route => route.label === 'Pharmacy Requests')
  const operations = auth.MODULE_ROUTES.find(route => route.label === 'Pharmacy Operations')

  assert.equal(JSON.stringify(requests), JSON.stringify({ href: '/pharmacy', label: 'Pharmacy Requests', module: 'Pharmacy' }))
  assert.equal(JSON.stringify(operations), JSON.stringify({
    href: 'https://pharmacy-portal-delta.vercel.app/staff/login',
    label: 'Pharmacy Operations',
    module: 'Pharmacy',
    external: true,
  }))
  assert.equal(auth.MODULE_ROUTES.some(route => route.href.includes('aggregator')), false)
})

test('Pharmacy-only users see both Pharmacy entries and no unrelated modules', () => {
  const visible = auth.MODULE_ROUTES.filter(route => auth.hasModuleAccess(pharmacyUser, route.module))
  assert.equal(JSON.stringify(visible.map(route => route.label)), JSON.stringify(['Pharmacy Requests', 'Pharmacy Operations']))
})

test('first Pharmacy route remains the internal requests route', () => {
  const first = auth.MODULE_ROUTES.find(route => !route.external && auth.hasModuleAccess(pharmacyUser, route.module))
  assert.equal(first.href, '/pharmacy')
})

test('login and AppShell skip external routes when choosing a landing page', () => {
  const login = fs.readFileSync('app/login/page.tsx', 'utf8')
  const shell = fs.readFileSync('components/AppShell.tsx', 'utf8')
  assert.match(login, /!r\.external && \(isAll \|\| modules\.includes\(r\.module\)\)/)
  assert.match(shell, /!r\.external && hasModuleAccess\(session, r\.module\)/)
})

test('Sidebar opens operations externally and never marks it active', () => {
  const source = fs.readFileSync('components/Sidebar.tsx', 'utf8')
  assert.match(source, /target="_blank"/)
  assert.match(source, /rel="noopener noreferrer"/)
  assert.match(source, /!external && path\.startsWith\(href\)/)
})

test('proxy remains pharmacy-only', () => {
  const source = fs.readFileSync('proxy.ts', 'utf8')
  assert.match(source, /path !== '\/pharmacy' && !path\.startsWith\('\/pharmacy\/'\)/)
  assert.match(source, /matcher:\s*\['\/pharmacy\/:path\*'\]/)
  assert.doesNotMatch(source, /mlr.*pharmacy\/login|pharmacy\/login.*mlr/i)
})
