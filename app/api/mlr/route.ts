import { NextResponse } from 'next/server'

<<<<<<< HEAD
  const configured = (
    process.env.MEDICLOUD_API_URL ??
    process.env.MLR_API_URL ??
    'https://api.clearlinehmo.com'
  ).replace(/\/+$/, '')

  const hostBase = configured.replace(/\/api\/v1$/, '').replace(/\/mlr$/, '')
  const MEDICLOUD_BASE = `${hostBase}/mlr`

  const MEDICLOUD_API_KEY = process.env.MEDICLOUD_API_KEY ?? ''

  export const maxDuration = 60

  export async function GET(request: Request) {
    if (!MEDICLOUD_API_KEY) {
      return NextResponse.json(
        { error: 'MediCloud API key is not configured' },
        { status: 503 }
      )
=======
export async function GET(req: NextRequest) {
  const configured = process.env.MLR_API_URL ?? process.env.API_URL ?? 'http://localhost:8000'
  const base = configured.replace(/\/+$/, '')
  // Accept either a host (https://api.example.com) or a versioned API base.
  // The office deployment mounts MLR at /mlr (not under /api/v1).
  const hostBase = base.replace(/\/api\/v1$/, '').replace(/\/mlr$/, '')
  const mlrApiUrl = `${hostBase}/mlr`
  const { searchParams } = req.nextUrl

  try {
    const res = await fetch(
      `${mlrApiUrl}/summary?${searchParams.toString()}`,
      {
        cache: 'no-store',
        headers: {
          Accept: 'application/json',
          ...(process.env.MEDICLOUD_API_KEY
            ? { 'X-API-Key': process.env.MEDICLOUD_API_KEY }
            : {}),
        },
      }
    )
    if (!res.ok) {
      const text = await res.text()
      return NextResponse.json({ error: text }, { status: res.status })
>>>>>>> bf7f677 (Point MLR proxy at office root route)
    }

    try {
      const params = new URL(request.url).searchParams
      const query = new URLSearchParams({
        limit: params.get('limit') ?? '50',
        offset: params.get('offset') ?? '0',
      })

      const search = params.get('search')?.trim()
      if (search) query.set('search', search)

      const response = await fetch(
        `${MEDICLOUD_BASE}/mlr/summary?${query.toString()}`,
        {
          cache: 'no-store',
          signal: AbortSignal.timeout(55_000),
          headers: {
            Accept: 'application/json',
            'X-API-Key': MEDICLOUD_API_KEY,
          },
        }
      )

      const body = await response.text()

      return new NextResponse(body, {
        status: response.status,
        headers: {
          'content-type':
            response.headers.get('content-type') ?? 'application/json',
        },
      })
    } catch {
      return NextResponse.json(
        { error: 'Live MLR service unavailable' },
        { status: 502 }
      )
    }
  }
