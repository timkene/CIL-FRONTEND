import 'server-only'
import { NextRequest, NextResponse } from 'next/server'

export const PHARMACY_COOKIE = 'cil_pharmacy_session'
export const pharmacyCookieOptions = () => ({
  httpOnly: true, secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const, path: '/',
})

export function pharmacyJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function clearPharmacyCookie(response: NextResponse) {
  response.cookies.set(PHARMACY_COOKIE, '', { ...pharmacyCookieOptions(), maxAge: 0 })
  return response
}

export function unauthenticated() {
  return clearPharmacyCookie(pharmacyJson({ detail: 'Pharmacy staff sign-in required.' }, 401))
}

// Validate transport safety only. Never interpret the backend's token format or claims.
export function isOpaqueSession(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 3800 && /^[\x21-\x7e]+$/.test(value) && !/[;,"\\]/.test(value)
}

export function pharmacySession(request: NextRequest) {
  const value = request.cookies.get(PHARMACY_COOKIE)?.value
  return isOpaqueSession(value) ? value : undefined
}

export function sameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin || request.headers.get('sec-fetch-site') === 'cross-site') return false
  try {
    // Production never trusts Host/X-Forwarded-Host to choose an allowed origin.
    const configured = process.env.CIL_PHARMACY_ORIGIN ?? 'https://cil-frontend.vercel.app'
    const trusted = new URL(configured)
    if (trusted.protocol === 'https:' && configured === trusted.origin && origin === trusted.origin) return true
    if (process.env.NODE_ENV !== 'production') {
      const local = new URL(request.url)
      return local.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(local.hostname) && origin === local.origin
    }
  } catch { /* Invalid configuration fails closed. */ }
  return false
}

export async function pharmacyUpstream(path: string, session?: string, init?: RequestInit) {
  const base = new URL(process.env.PHARMACY_API_URL ?? 'https://pharmacy-dispatch-api.onrender.com')
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(base.hostname)
  if (base.username || base.password || base.search || base.hash || base.pathname !== '/' ||
      (base.protocol !== 'https:' && !(process.env.NODE_ENV !== 'production' && local && base.protocol === 'http:'))) {
    throw new Error('Invalid Pharmacy backend configuration')
  }
  return fetch(new URL(path, base), {
    ...init, cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(15_000),
    headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(session ? { Cookie: `staff_session=${session}` } : {}) },
  })
}

export interface PharmacyIdentity { userId: string; name: string; email: string }
export function safeIdentity(value: unknown): PharmacyIdentity | null {
  if (!value || typeof value !== 'object') return null
  const data = value as Record<string, unknown>
  if (!['userId', 'name', 'email'].every(key => typeof data[key] === 'string' && (data[key] as string).trim().length > 0)) return null
  return { userId: data.userId as string, name: data.name as string, email: data.email as string }
}

export async function verifyPharmacySession(session: string): Promise<
  { status: 200; identity: PharmacyIdentity } | { status: 401 | 502 | 503 }
> {
  try {
    const response = await pharmacyUpstream('/api/auth/staff/me', session)
    if (response.status === 401) return { status: 401 }
    if (!response.ok) return { status: response.status >= 500 ? 503 : 502 }
    const identity = safeIdentity(await response.json())
    if (!identity || Object.values(identity).some(value => value.includes(session))) return { status: 502 }
    return { status: 200, identity }
  } catch { return { status: 503 } }
}

export async function readPharmacyBody(request: NextRequest): Promise<Record<string, unknown> | null> {
  if (request.headers.get('content-type')?.split(';')[0].trim() !== 'application/json') return null
  const raw = await request.text()
  if (raw.length > 131072) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' && !Array.isArray(value) ? value : null
  } catch { return null }
}

export const pharmacyUnavailable = (status = 503) => pharmacyJson({ detail: 'Pharmacy service unavailable. Please try again.' }, status)
