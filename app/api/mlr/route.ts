import { NextResponse } from 'next/server'

const MEDICLOUD_BASE = (process.env.MEDICLOUD_API_URL ?? 'https://api.clearlinehmo.com').replace(/\/$/, '')
const MEDICLOUD_API_KEY = process.env.MEDICLOUD_API_KEY ?? ''
export const maxDuration = 60

export async function GET() {
  if (!MEDICLOUD_API_KEY) {
    return NextResponse.json({ error: 'MediCloud API key is not configured' }, { status: 503 })
  }
  try {
    const response = await fetch(`${MEDICLOUD_BASE}/mlr/summary`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
      headers: { Accept: 'application/json', 'X-API-Key': MEDICLOUD_API_KEY },
    })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Live MLR service unavailable' }, { status: 502 })
  }
}
