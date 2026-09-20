import { NextRequest } from 'next/server'
import { pharmacyJson, pharmacySession, pharmacyUnavailable, unauthenticated, verifyPharmacySession } from '@/lib/pharmacy-server'

export async function GET(request: NextRequest) {
  const session = pharmacySession(request)
  if (!session) return unauthenticated()
  const verified = await verifyPharmacySession(session)
  if (verified.status === 401) return unauthenticated()
  if (verified.status !== 200) return pharmacyUnavailable(verified.status)
  return pharmacyJson(verified.identity)
}
