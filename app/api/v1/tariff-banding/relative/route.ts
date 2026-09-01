import { NextResponse } from 'next/server'

const upstream = (process.env.TARIFF_API_URL ?? 'https://clearline-tariff-api.onrender.com')
  .replace(/\/+$/, '')
  .replace(/\/api\/v1$/, '')

export async function POST(request: Request) {
  try {
    const body = await request.text()
    const response = await fetch(`${upstream}/api/v1/tariff-banding/relative`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', accept: 'application/json' },
      body,
      cache: 'no-store',
      signal: AbortSignal.timeout(55_000),
    })
    const text = await response.text()
    return new NextResponse(text, {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ error: 'Tariff service unavailable' }, { status: 502 })
  }
}
