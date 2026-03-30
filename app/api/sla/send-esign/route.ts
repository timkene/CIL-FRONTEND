import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const apiUrl = process.env.SLA_API_URL
  if (!apiUrl) return NextResponse.json({ error: 'SLA_API_URL not configured' }, { status: 500 })

  const res = await fetch(`${apiUrl}/sla/send-esign`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json()
  return NextResponse.json(data, { status: res.status })
}
