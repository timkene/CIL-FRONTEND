import { NextRequest, NextResponse } from 'next/server'

const base = (process.env.TARIFF_API_URL ?? 'https://clearline-tariff-api.onrender.com').replace(/\/+$/, '')

// Full-core A→C on live tariff-api can take ~1 minute. Vercel’s default
// function limit (~10–15s) would abort the same-origin proxy before Render returns.
export const maxDuration = 300

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const response = await fetch(`${base}/api/v1/tariff-banding/negotiate-v2`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(280_000),
    })
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ detail: 'Tariff service unavailable' }, { status: 502 })
  }
}
