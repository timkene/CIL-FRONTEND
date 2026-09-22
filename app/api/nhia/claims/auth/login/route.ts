import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, COOKIE_PATH, csrfFailure, trustedClientIp, unavailable, upstream } from '@/lib/server/claims-gateway'

export async function POST(request: NextRequest) {
  const denied = csrfFailure(request)
  if (denied) return denied
  const input = await request.json().catch(() => ({}))
  if (!input || typeof input !== 'object' || typeof input.operator_id !== 'string' || typeof input.credential !== 'string'
      || input.operator_id.length > 128 || input.credential.length > 1024) {
    return NextResponse.json({ detail: 'Invalid Claims credentials' }, { status: 400 })
  }
  try {
    const response = await upstream('auth/login', 'POST', undefined, JSON.stringify({
      operator_id: input.operator_id, credential: input.credential,
    }), undefined, trustedClientIp(request))
    if (!response.ok) return NextResponse.json({ detail: 'Claims authorization failed' }, { status: response.status })
    const { token } = await response.json()
    if (typeof token !== 'string') return unavailable()
    const out = NextResponse.json({ ok: true })
    out.cookies.set(COOKIE, token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'strict',
      path: COOKIE_PATH, maxAge: 3600,
    })
    return out
  } catch { return unavailable() }
}
