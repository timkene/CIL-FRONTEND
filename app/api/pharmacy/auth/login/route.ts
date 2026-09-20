import { NextRequest } from 'next/server'
import { PHARMACY_COOKIE, isOpaqueSession, pharmacyCookieOptions, pharmacyJson, pharmacyUnavailable, pharmacyUpstream, readPharmacyBody, safeIdentity, sameOrigin, unauthenticated, verifyPharmacySession } from '@/lib/pharmacy-server'

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return pharmacyJson({ detail: 'Forbidden origin.' }, 403)
  try {
    const body = await readPharmacyBody(request)
    if (!body || typeof body.email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email) || body.email.length > 254 || typeof body.password !== 'string' || !body.password || body.password.length > 4096) {
      return pharmacyJson({ detail: 'Enter a valid email and password.' }, 422)
    }
    const upstream = await pharmacyUpstream('/api/auth/staff/login', undefined, {
      method: 'POST', body: JSON.stringify({ email: body.email, password: body.password }),
    })
    if (upstream.status === 401) return pharmacyJson({ detail: 'Invalid email or password.' }, 401)
    if (upstream.status === 422) return pharmacyJson({ detail: 'Enter a valid email and password.' }, 422)
    if (!upstream.ok) return pharmacyUnavailable(upstream.status >= 500 ? 503 : 502)
    const data = await upstream.json()
    if (!data || data.success !== true || !isOpaqueSession(data.session) || !safeIdentity({ ...data.user, userId: 'validation-only' })) return pharmacyUnavailable(502)
    // A login response alone is insufficient: the backend must confirm staff identity.
    const verified = await verifyPharmacySession(data.session)
    if (verified.status === 401) return unauthenticated()
    if (verified.status !== 200) return pharmacyUnavailable(verified.status)
    const response = pharmacyJson({ success: true, user: verified.identity })
    response.cookies.set(PHARMACY_COOKIE, data.session, { ...pharmacyCookieOptions(), maxAge: 86400 })
    return response
  } catch { return pharmacyUnavailable() }
}
