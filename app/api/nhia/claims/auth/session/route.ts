import { NextRequest, NextResponse } from 'next/server'
import { relay, tokenFrom, unavailable, upstream } from '@/lib/server/claims-gateway'

export async function GET(request: NextRequest) {
  const token = tokenFrom(request)
  if (!token) return NextResponse.json({ detail: 'Claims authorization required' }, { status: 401 })
  try { return relay(await upstream('auth/session', 'GET', token)) }
  catch { return unavailable() }
}
