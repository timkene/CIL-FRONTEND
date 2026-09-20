import { NextRequest, NextResponse } from 'next/server'
import { clearPharmacyCookie, pharmacySession, verifyPharmacySession } from '@/lib/pharmacy-server'

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname === '/pharmacy/login') return NextResponse.next()
  const session = pharmacySession(request)
  const verified = session ? await verifyPharmacySession(session) : { status: 401 }
  if (verified.status === 401) {
    return clearPharmacyCookie(NextResponse.redirect(new URL('/pharmacy/login', request.url)))
  }
  if (verified.status !== 200) {
    return new NextResponse('<!doctype html><html lang="en"><title>Pharmacy unavailable</title><body><h1>Pharmacy temporarily unavailable</h1><p>Your session could not be verified. Please try again.</p><a href="/pharmacy">Retry Pharmacy</a></body></html>', {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  const response = NextResponse.next()
  response.headers.set('Cache-Control', 'no-store')
  return response
}

export const config = { matcher: ['/pharmacy/:path*'] }
