import { NextRequest, NextResponse } from 'next/server'
import { COOKIE, COOKIE_PATH, csrfFailure, tokenFrom, upstream } from '@/lib/server/claims-gateway'

export async function POST(request: NextRequest) {
  const denied = csrfFailure(request)
  if (denied) return denied
  const token = tokenFrom(request)
  if (token) {
    try {
      const upstreamResponse = await upstream('auth/logout', 'POST', token)
      if (!upstreamResponse.ok) return NextResponse.json({ detail: 'Claims sign-out could not be verified' }, { status: 503 })
    }
    catch { return NextResponse.json({ detail: 'Claims service unavailable' }, { status: 503 }) }
  }
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE, '', { path: COOKIE_PATH, maxAge: 0 })
  return response
}
