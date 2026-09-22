import { NextRequest, NextResponse } from 'next/server'
import { relay, tokenFrom, unavailable, upstream } from '@/lib/server/claims-gateway'

export async function GET(request: NextRequest) {
  const token = tokenFrom(request)
  if (!token) return NextResponse.json({ detail: 'Claims authorization required' }, { status: 401 })
  const params = request.nextUrl.searchParams
  if (['batch_id', 'enrollee_id', 'procedure_code'].some(key => !params.get(key) || params.get(key)!.length > 256)) {
    return NextResponse.json({ detail: 'Invalid claim key' }, { status: 400 })
  }
  try { return relay(await upstream(`reconcile-candidates?${params}`, 'GET', token)) }
  catch { return unavailable() }
}
