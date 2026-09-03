import { NextRequest, NextResponse } from 'next/server'
const base = (process.env.TARIFF_API_URL ?? 'https://clearline-tariff-api.onrender.com').replace(/\/+$/, '')
export async function GET(request: NextRequest) {
  const response = await fetch(`${base}/api/v1/tariff-banding/providers${request.nextUrl.search}`, { cache: 'no-store' })
  return new NextResponse(await response.text(), { status: response.status, headers: { 'content-type': 'application/json' } })
}
