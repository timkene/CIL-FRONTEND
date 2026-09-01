import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const configured = process.env.MLR_API_URL ?? process.env.API_URL ?? 'http://localhost:8000'
  const base = configured.replace(/\/+$/, '')
  // Accept either a host (https://api.example.com) or a versioned API base.
  const mlrApiUrl = /\/api\/v1$/.test(base) ? `${base}/mlr` : `${base}/api/v1/mlr`
  const { searchParams } = req.nextUrl

  try {
    const res = await fetch(
      `${mlrApiUrl}/mlr/summary?${searchParams.toString()}`,
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
    }
    return NextResponse.json(await res.json())
  } catch {
    return NextResponse.json(
      { error: `MLR API unreachable at ${mlrApiUrl}. Make sure it is running.` },
      { status: 503 }
    )
  }
}
