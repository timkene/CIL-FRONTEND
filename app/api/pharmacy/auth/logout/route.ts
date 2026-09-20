import { NextRequest } from 'next/server'
import { clearPharmacyCookie, pharmacyJson, sameOrigin } from '@/lib/pharmacy-server'

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return pharmacyJson({ detail: 'Forbidden origin.' }, 403)
  return clearPharmacyCookie(pharmacyJson({ success: true }))
}
