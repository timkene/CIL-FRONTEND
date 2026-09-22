import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { isIP } from 'node:net'
import { signClaimsMutation, validClaimsOrigin } from '@/lib/claims-gateway-core'

export const COOKIE = 'claims_payment_session'
export const COOKIE_PATH = '/api/nhia/claims'

function config() {
  const base = process.env.NHIA_CLAIMS_API_URL
  const signingKey = process.env.CLAIMS_GATEWAY_SIGNING_KEY
  const apiKey = process.env.CLAIMS_GATEWAY_API_KEY
  if (!base || !/^https:\/\//.test(base) && !/^http:\/\/localhost(?::\d+)?$/.test(base)
      || !signingKey || signingKey.length < 32 || !apiKey || apiKey.length < 32
      || signingKey === apiKey) throw new Error('Claims gateway is not configured')
  return { base: base.replace(/\/$/, ''), signingKey, apiKey }
}

export function sameOrigin(request: NextRequest): boolean {
  return validClaimsOrigin(request.headers.get('origin'), request.headers.get('host'),
    request.headers.get('sec-fetch-site'))
}

export function csrfFailure(request: NextRequest): NextResponse | null {
  return sameOrigin(request) ? null : NextResponse.json({ detail: 'Invalid request origin' }, { status: 403 })
}

export async function upstream(path: string, method: 'GET' | 'POST', token?: string,
                               body?: string, assertion?: string, clientIp?: string) {
  const { base, apiKey } = config()
  return fetch(`${base}/api/v1/nhia/claims/${path}`, {
    method, cache: 'no-store', redirect: 'error',
    headers: {
      'X-Claims-Gateway-Key': apiKey,
      ...(clientIp ? { 'X-Claims-Client-IP': clientIp } : {}),
      ...(token ? { 'X-Claims-Session': token } : {}),
      ...(assertion ? { 'X-Claims-Assertion': assertion } : {}),
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body !== undefined ? { body } : {}),
  })
}

export async function relay(response: Response) {
  const data = await response.json().catch(() => ({ detail: 'Claims service unavailable' }))
  return NextResponse.json(data, { status: response.status })
}

export function assertion(operatorId: string, token: string, action: string, body: string): string {
  const { signingKey } = config()
  return signClaimsMutation(operatorId, token, action, signingKey, body)
}

export function trustedClientIp(request: NextRequest): string {
  // Vercel overwrites x-forwarded-for; no browser-supplied IP header is relayed.
  if (process.env.VERCEL !== '1') return '127.0.0.1'
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || ''
  return isIP(ip) ? ip : 'unknown'
}

export function tokenFrom(request: NextRequest): string {
  return request.cookies.get(COOKIE)?.value ?? ''
}

export function unavailable() {
  return NextResponse.json({ detail: 'Claims service unavailable' }, { status: 503 })
}
