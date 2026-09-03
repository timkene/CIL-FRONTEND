import { NextRequest, NextResponse } from 'next/server'

const base = (process.env.TARIFF_API_URL ?? 'https://clearline-tariff-api.onrender.com').replace(/\/+$/, '')

export async function POST(request: NextRequest) {
  try {
    const body = await request.text()
    const response = await fetch(`${base}/api/v1/tariff-banding/analyze`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    })
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    })
  } catch {
    return NextResponse.json({ detail: 'Tariff service unavailable' }, { status: 502 })
  }
}
