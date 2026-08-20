import { NextRequest, NextResponse } from 'next/server'

const MEDICLOUD_BASE = process.env.MEDICLOUD_API_URL ?? 'https://api.clearlinehmo.com'
const MEDICLOUD_API_KEY = process.env.MEDICLOUD_API_KEY ?? ''
const ALLOWED_PATHS = new Set(['procedures', 'diagnoses'])

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params
  if (path.length !== 1 || !ALLOWED_PATHS.has(path[0])) {
    return NextResponse.json({ detail: 'Not found' }, { status: 404 })
  }
  if (!MEDICLOUD_API_KEY) {
    return NextResponse.json({ detail: 'MediCloud API key is not configured' }, { status: 503 })
  }

  const upstream = new URL(`${MEDICLOUD_BASE.replace(/\/$/, '')}/${path[0]}`)
  request.nextUrl.searchParams.forEach((value, key) => upstream.searchParams.set(key, value))

  try {
    const response = await fetch(upstream, {
      headers: { 'X-API-Key': MEDICLOUD_API_KEY, Accept: 'application/json' },
      cache: 'no-store',
    })
    const body = await response.text()
    return new NextResponse(body, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ detail: 'MediCloud service unavailable' }, { status: 502 })
  }
}
