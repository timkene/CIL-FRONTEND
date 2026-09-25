import { NextRequest } from 'next/server'
import { pharmacyJson, pharmacySession, pharmacyUnavailable, pharmacyUpstream, readPharmacyBody, sameOrigin, unauthenticated } from '@/lib/pharmacy-server'

const ACTION_FIELDS: Record<string, readonly string[]> = {
  assign: ['aggregatorId', 'expectedVersion'],
  'direct-approve': ['expectedVersion', 'adjusted_price', 'procedurePrices', 'reason'],
  'direct-deny': ['expectedVersion', 'reason'], recall: ['expectedVersion', 'reason'],
  'adjust-price': ['expectedVersion', 'totalPrice', 'procedurePrices', 'reason'], cancel: ['expectedVersion', 'reason'],
  approve: [], reject: ['comment'], 'close-bidding': [],
  'clearline-approve': ['adjusted_price', 'procedurePrices', 'reason'], 'staff-confirm': [],
  'generate-pa': ['expectedVersion'],
}
const ORDER_FIELDS = ['enrollee', 'provider', 'medications']

// Keep the existing /api/orders contract beneath a same-origin /api/pharmacy prefix.
function contract(path: string[], method: string): { fields: readonly string[] } | null {
  if (path[0] !== 'api') return null
  if (path.length === 2 && path[1] === 'aggregators' && method === 'GET') return { fields: [] }
  if (path[1] !== 'orders') return null
  if (path.length === 2 && ['GET', 'POST'].includes(method)) return { fields: ORDER_FIELDS }
  if (!/^[a-fA-F0-9]{24}$/.test(path[2] ?? '')) return null
  if (path.length === 3 && ['GET', 'PUT'].includes(method)) return { fields: ORDER_FIELDS }
  if (path.length === 6 && path[3] === 'pa-lines' && /^[a-zA-Z0-9-]{1,80}$/.test(path[4]) && path[5] === 'verify' && method === 'POST') return { fields: ['resolution', 'evidence', 'paNumber', 'confirmNoPaCreated', 'verificationMethod', 'checkedWith', 'verifiedAt'] }
  if (path.length === 5 && path[3] === 'pa-interruption' && path[4] === 'mark-verification-required' && method === 'POST') return { fields: [] }
  if (path.length === 4 && method === 'POST' && Object.hasOwn(ACTION_FIELDS, path[3])) return { fields: ACTION_FIELDS[path[3]] }
  return null
}

function sanitize(value: unknown, session: string): unknown {
  if (typeof value === 'string') return value.replaceAll(session, '[redacted]')
  if (Array.isArray(value)) return value.map(item => sanitize(item, session))
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !/session|token|password|secret|cookie|authorization/i.test(key))
    .map(([key, item]) => [key.replaceAll(session, '[redacted]'), sanitize(item, session)]))
  return value
}

async function handle(request: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params
  const allowed = contract(path, request.method)
  if (!allowed || new URL(request.url).search) return pharmacyJson({ detail: 'Not found.' }, 404)
  if (request.method !== 'GET' && !sameOrigin(request)) return pharmacyJson({ detail: 'Forbidden origin.' }, 403)
  const session = pharmacySession(request)
  if (!session) return unauthenticated()
  try {
    let body: string | undefined
    if (['POST', 'PUT'].includes(request.method)) {
      // Bodyless legacy actions remain bodyless. JSON bodies are limited to this action's contract.
      const raw = await request.clone().text()
      if (raw) {
        const parsed = await readPharmacyBody(request)
        if (!parsed || Object.keys(parsed).some(key => !allowed.fields.includes(key))) return pharmacyJson({ detail: 'Invalid Pharmacy request.' }, 422)
        body = JSON.stringify(parsed)
      }
    }
    if (path[3] === 'generate-pa' && (!body || !Number.isSafeInteger(JSON.parse(body).expectedVersion) || JSON.parse(body).expectedVersion < 0)) return pharmacyJson({ detail: 'expectedVersion is required.' }, 422)
    const upstream = await pharmacyUpstream('/' + path.join('/'), session, { method: request.method, body }, path[3] === 'generate-pa' ? 270_000 : undefined)
    if (upstream.status === 401) return unauthenticated()
    if (upstream.status >= 500) return path[3] === 'generate-pa'
      ? pharmacyJson({ detail: 'PA result may be unknown. Refresh and verify this order before any retry.' }, upstream.status)
      : pharmacyUnavailable(upstream.status)
    const data = await upstream.json()
    if (!upstream.ok) {
      const detail = typeof data?.detail === 'string' ? sanitize(data.detail.slice(0, 2000), session) : 'Please check the request and try again.'
      return pharmacyJson({ detail }, upstream.status)
    }
    if (request.method !== 'GET') {
      if (!data || (!['generate-pa', 'pa-lines', 'pa-interruption'].includes(path[3]) && data.success !== true)) return pharmacyUnavailable(502)
      return pharmacyJson(sanitize(Object.fromEntries(Object.entries(data).filter(([key]) => ['success', 'orderId', 'status', 'version', 'assignmentVersion', 'lines', 'line'].includes(key))), session), upstream.status)
    }
    return pharmacyJson(sanitize(data, session), upstream.status)
  } catch { return path[3] === 'generate-pa'
    ? pharmacyJson({ detail: 'PA result may be unknown. Refresh and verify this order before any retry.' }, 504)
    : pharmacyUnavailable() }
}

export const maxDuration = 300
export { handle as GET, handle as POST, handle as PUT }
