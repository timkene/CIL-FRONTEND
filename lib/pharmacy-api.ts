import type { PharmacyOrder, PharmacyAggregator, SearchResult, Enrollee, Medication, Provider } from './pharmacy-types'

const BASE = '/api/pharmacy'

export class PharmacyApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'PharmacyApiError'
  }
}

async function pharmacyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401 && typeof window !== 'undefined' && window.location.pathname !== '/pharmacy/login') {
      window.location.assign('/pharmacy/login')
    }
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

export const approvePharmacyOrder = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/approve`, { method: 'POST' })

export const closePharmacyBidding = (id: string) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/close-bidding`, { method: 'POST' })

export const rejectPharmacyOrder = async (id: string, comment: string) => {
  if (!comment.trim()) throw new Error('A denial comment is required.')
  return pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/reject`, {
    method: 'POST',
    body: JSON.stringify({ comment: comment.trim() }),
  })
}

export const listPharmacyAggregators = async () => {
  const data = await pharmacyFetch<PharmacyAggregator[] | { aggregators?: PharmacyAggregator[] }>('/api/aggregators')
  if (Array.isArray(data)) return data
  return Array.isArray(data.aggregators) ? data.aggregators : []
}

export const assignPharmacyOrder = (id: string, aggregatorId: string, expectedVersion?: number) =>
  pharmacyFetch<{ success: boolean }>(`/api/orders/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ aggregatorId, expectedVersion }),
  })

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

// MediCloud calls go through the Next.js server proxy.  The API key must never
// be exposed in a NEXT_PUBLIC_* browser bundle.
const MEDICLOUD_BASE = '/api/medicloud'

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

export interface LifecycleResult { success: boolean; status: import('./pharmacy-types').OrderStatus; version: number; assignmentVersion: number }
export type StaffLifecycleAction = 'direct-approve' | 'direct-deny' | 'recall' | 'adjust-price' | 'cancel'
export type StaffLifecycleRequest =
  | { action: 'direct-approve'; expectedVersion: number; adjusted_price?: number; reason?: string }
  | { action: 'direct-deny' | 'recall' | 'cancel'; expectedVersion: number; reason: string }
  | { action: 'adjust-price'; expectedVersion: number; totalPrice: number; reason: string }

export async function mutatePharmacyLifecycle(id: string, request: StaffLifecycleRequest) {
  const { action, ...body } = request
  const price = 'totalPrice' in body ? body.totalPrice : 'adjusted_price' in body ? body.adjusted_price : undefined
  if (price !== undefined && (!Number.isFinite(price) || price <= 0)) throw new Error('Price must be a positive finite Naira amount.')
  if (action !== 'direct-approve' || price !== undefined) {
    if (!body.reason?.trim() || body.reason.trim().length > 2000) throw new Error('A reason of 1–2,000 characters is required.')
  }
  return pharmacyFetch<LifecycleResult>(`/api/orders/${id}/${action}`, {
    method: 'POST', body: JSON.stringify({ ...body, ...('reason' in body ? { reason: body.reason?.trim() } : {}) }),
  })
}

export async function pharmacyMutationError(error: unknown, refresh: () => Promise<void>): Promise<string> {
  if (error instanceof PharmacyApiError && error.status === 409) {
    try { await refresh() } catch { return 'This order changed. Refresh failed; reload the order before trying again.' }
    return 'This order was updated by someone else. The latest information has been loaded. Review it before trying again.'
  }
  return error instanceof Error ? error.message : 'Action failed. Please try again.'
}

export interface PharmacyStaffIdentity { userId: string; name: string; email: string }

export const loginPharmacyStaff = (email: string, password: string) =>
  pharmacyFetch<{ success: boolean; user: PharmacyStaffIdentity }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password }),
  })

export const logoutPharmacyStaff = () =>
  pharmacyFetch<{ success: boolean }>('/auth/logout', { method: 'POST' })
