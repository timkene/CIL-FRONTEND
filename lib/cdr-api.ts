import type {
  CdrEnrollee,
  CdrEnrolleeCreate,
  CdrInventoryItem,
  CdrStats,
  CdrSupply,
  CdrVitalsCheckin,
  SupplyStatus,
} from './cdr-types'

const BASE = process.env.NEXT_PUBLIC_KLAIRE_API_URL ?? ''
const SERVICE_KEY = process.env.NEXT_PUBLIC_KLAIRE_SERVICE_KEY ?? ''

export class CdrApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'CdrApiError'
  }
}

async function cdrFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Key': SERVICE_KEY,
      ...(init?.headers as Record<string, string> | undefined),
    },
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new CdrApiError(
      res.status,
      (data as { detail?: string }).detail ?? `HTTP ${res.status}`
    )
  }
  return data as T
}

// ── Enrollees ──────────────────────────────────────────────────────────────────

export const listEnrollees = (status = '', page = 1, limit = 50) =>
  cdrFetch<{ data: CdrEnrollee[]; total: number; page: number; limit: number }>(
    `/team/api/cdr/enrollees?status=${status}&page=${page}&limit=${limit}`
  )

export const createEnrollee = (body: CdrEnrolleeCreate) =>
  cdrFetch<{ ok: boolean; enrollee_id: string; next_due_at: string }>(
    '/team/api/cdr/enrollees',
    { method: 'POST', body: JSON.stringify(body) }
  )

export const updateEnrollee = (
  enrolleeId: string,
  body: { firstname?: string; phone?: string; status?: string }
) =>
  cdrFetch<{ ok: boolean }>(
    `/team/api/cdr/enrollees/${encodeURIComponent(enrolleeId)}`,
    { method: 'PUT', body: JSON.stringify(body) }
  )

// ── Supplies ──────────────────────────────────────────────────────────────────

export const listSupplies = (status: SupplyStatus | '' = '', page = 1, limit = 50) =>
  cdrFetch<{ data: CdrSupply[]; total: number; page: number; limit: number }>(
    `/team/api/cdr/supplies?status=${status}&page=${page}&limit=${limit}`
  )

export const confirmSupply = (supplyId: string) =>
  cdrFetch<{ ok: boolean; next_due_at: string }>(
    `/team/api/cdr/supplies/${supplyId}/confirm`,
    { method: 'POST' }
  )

export const cancelSupply = (supplyId: string) =>
  cdrFetch<{ ok: boolean }>(`/team/api/cdr/supplies/${supplyId}/cancel`, { method: 'POST' })

export const retrySupplyPa = (supplyId: string) =>
  cdrFetch<{ ok: boolean }>(`/team/api/cdr/supplies/${supplyId}/retry-pa`, { method: 'POST' })

// ── Inventory ─────────────────────────────────────────────────────────────────

export const listInventory = () =>
  cdrFetch<{ data: CdrInventoryItem[] }>('/team/api/cdr/inventory')

export const updateInventoryItem = (
  drugCode: string,
  body: { quantity_on_hand?: number; low_stock_threshold?: number; unit_price?: number }
) =>
  cdrFetch<{ ok: boolean }>(
    `/team/api/cdr/inventory/${encodeURIComponent(drugCode)}`,
    { method: 'PUT', body: JSON.stringify(body) }
  )

export const restockInventory = (items: { drug_code: string; quantity_added: number }[]) =>
  cdrFetch<{ results: { drug_code: string; ok: boolean }[] }>(
    '/team/api/cdr/inventory/restock',
    { method: 'POST', body: JSON.stringify({ items }) }
  )

// ── Vitals ────────────────────────────────────────────────────────────────────

export const listVitals = (page = 1, limit = 50) =>
  cdrFetch<{ data: CdrVitalsCheckin[]; total: number; page: number; limit: number }>(
    `/team/api/cdr/vitals?page=${page}&limit=${limit}`
  )

// ── Stats & trigger ───────────────────────────────────────────────────────────

export const getCdrStats = () => cdrFetch<CdrStats>('/team/api/cdr/stats')

export const triggerCdrNow = (dryRun = false) =>
  cdrFetch<{ triggered?: boolean; would_trigger?: { enrollee_id: string }[] }>(
    `/team/api/cdr/trigger-now?dry_run=${dryRun}`,
    { method: 'POST' }
  )
