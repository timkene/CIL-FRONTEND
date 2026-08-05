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

export const approvePharmacyOrder = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/approve`, { method: 'POST' })

export const closePharmacyBidding = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/close-bidding`, { method: 'POST' })

export const rejectPharmacyOrder = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/reject`, { method: 'POST' })

export const staffConfirmPharmacyReceipt = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/staff-confirm`, { method: 'POST' })

export const clearlineApprovePharmacyOrder = (id: string, adjustedPrice?: number) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/clearline-approve`, {
    method: 'POST',
    body: JSON.stringify(adjustedPrice !== undefined ? { adjusted_price: adjustedPrice } : {}),
  })

export const updatePharmacyOrder = (
  id: string,
  payload: { enrollee?: import('./pharmacy-types').Enrollee; provider?: import('./pharmacy-types').Provider; medications?: import('./pharmacy-types').Medication[] }
) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })

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

export const searchPharmacyMembers   = nhiaSearch('/api/search/members')
export const searchPharmacyProviders = nhiaSearch('/api/search/providers')

const MEDICLOUD_BASE = 'https://api.clearlinehmo.com'

export const searchPharmacyProcedures = async (q: string): Promise<SearchResult[]> => {
  if (!q.trim()) return []
  try {
    const res = await fetch(
      `${MEDICLOUD_BASE}/procedures?search=${encodeURIComponent(q)}&limit=20`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? data as unknown[]).map((p: Record<string, string>) => ({
      code:  p.procedure_code ?? '',
      label: p.procedure_name ?? '',
    }))
  } catch {
    return []
  }
}

export const searchPharmacyDiagnoses = async (q: string): Promise<SearchResult[]> => {
  if (!q.trim()) return []
  try {
    const res = await fetch(
      `${MEDICLOUD_BASE}/diagnoses?search=${encodeURIComponent(q)}&limit=20`
    )
    if (!res.ok) return []
    const data = await res.json()
    return (data.results ?? data as unknown[]).map((d: Record<string, string>) => ({
      code:  d.diagnosis_code ?? '',
      label: d.diagnosis_name ?? '',
    }))
  } catch {
    return []
  }
}

const NHIA_BASE = 'https://clearline-nhia-api.onrender.com'

export interface MemberDetail {
  phone: string | null
  address: string | null
  fullName: string | null
  title: string | null
  gender: string | null
  dateOfBirth: string | null
  planType: string | null
  groupName: string | null
  email: string | null
  effectiveDate: string | null
  terminationDate: string | null
  isterminated: boolean
}

const EMPTY_DETAIL: MemberDetail = {
  phone: null, address: null, fullName: null, title: null, gender: null,
  dateOfBirth: null, planType: null, groupName: null, email: null,
  effectiveDate: null, terminationDate: null, isterminated: false,
}

export const getPharmacyMemberDetail = async (enrolleeId: string): Promise<MemberDetail> => {
  try {
    const res = await fetch(`${NHIA_BASE}/api/members/${encodeURIComponent(enrolleeId)}`)
    if (!res.ok) return EMPTY_DETAIL
    return { ...EMPTY_DETAIL, ...(await res.json()) }
  } catch {
    return EMPTY_DETAIL
  }
}
