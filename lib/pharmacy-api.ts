import type { PharmacyOrder, SearchResult, Enrollee, Medication, Provider } from './pharmacy-types'

const BASE = process.env.NEXT_PUBLIC_PHARMACY_API_URL ?? 'https://pharmacy-dispatch-api.onrender.com'
const SERVICE_KEY = process.env.NEXT_PUBLIC_PHARMACY_SERVICE_KEY ?? ''

export class PharmacyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'PharmacyApiError'
  }
}

async function pharmacyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': SERVICE_KEY,
      ...init?.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new PharmacyApiError(
      res.status,
      (data as { message?: string; detail?: string }).message
        ?? (data as { message?: string; detail?: string }).detail
        ?? `HTTP ${res.status}`
    )
  }
  return data as T
}

export const getPharmacyOrders = () =>
  pharmacyFetch<{ orders: PharmacyOrder[] }>('/api/orders')

export const getPharmacyOrder = (id: string) =>
  pharmacyFetch<PharmacyOrder>(`/api/orders/${id}`)

export const createPharmacyOrder = (payload: {
  enrollee: Enrollee
  provider: Provider
  medications: Medication[]
}) =>
  pharmacyFetch<{ orderId: string }>('/api/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })

export const deletePharmacyOrder = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}`, { method: 'DELETE' })

const nhiaSearch = (path: string) => async (q: string): Promise<SearchResult[]> => {
  try {
    const res = await fetch(`https://clearline-nhia-api.onrender.com${path}?q=${encodeURIComponent(q)}`)
    if (!res.ok) return []
    const data = await res.json()
    return (data.results as SearchResult[]) ?? []
  } catch {
    return []
  }
}

export const searchPharmacyMembers    = nhiaSearch('/api/search/members')
export const searchPharmacyProviders  = nhiaSearch('/api/search/providers')
export const searchPharmacyProcedures = nhiaSearch('/api/search/procedures')
export const searchPharmacyDiagnoses  = nhiaSearch('/api/search/diagnoses')

export const getPharmacyMemberDetail = async (
  enrolleeId: string
): Promise<{ phone: string | null; address: string | null }> => {
  try {
    return await pharmacyFetch<{ phone: string | null; address: string | null }>(
      `/api/members/${encodeURIComponent(enrolleeId)}`
    )
  } catch {
    return { phone: null, address: null }
  }
}
