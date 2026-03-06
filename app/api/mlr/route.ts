import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const mlrApiUrl = process.env.MLR_API_URL ?? 'http://localhost:8004'
  const { searchParams } = req.nextUrl

  try {
    const res = await fetch(
      `${mlrApiUrl}/mlr/summary?${searchParams.toString()}`,
      { cache: 'no-store' }
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
