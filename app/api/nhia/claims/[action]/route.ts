import { NextRequest, NextResponse } from 'next/server'
import { assertion, csrfFailure, relay, tokenFrom, unavailable, upstream } from '@/lib/server/claims-gateway'

const ACTIONS: Record<string, string> = {
  pay: 'claims.pay', unpay: 'claims.unpay', reconcile: 'claims.reconcile',
}

export async function POST(request: NextRequest, context: { params: Promise<{ action: string }> }) {
  const denied = csrfFailure(request)
  if (denied) return denied
  const { action } = await context.params
  if (!Object.prototype.hasOwnProperty.call(ACTIONS, action)) return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  const token = tokenFrom(request)
  if (!token) return NextResponse.json({ detail: 'Claims authorization required' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (!body || JSON.stringify(body).length > 100000) {
    return NextResponse.json({ detail: 'Invalid request' }, { status: 400 })
  }
  try {
    const status = await upstream('auth/session', 'GET', token)
    if (!status.ok) return relay(status)
    const operator = await status.json()
    if (!operator.grants?.includes(ACTIONS[action])) {
      return NextResponse.json({ detail: 'Claims permission required' }, { status: 403 })
    }
    const serializedBody = JSON.stringify(body)
    return relay(await upstream(action, 'POST', token, serializedBody,
      assertion(operator.id, token, ACTIONS[action], serializedBody)))
  } catch { return unavailable() }
}
