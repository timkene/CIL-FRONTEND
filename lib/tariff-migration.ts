export const STATUSES = ['AUTO_MATCHED', 'REVIEW_REQUIRED', 'MISSING_STRENGTH', 'AMBIGUOUS', 'NO_MATCH', 'ACCEPTED', 'CHANGED', 'REJECTED'] as const
export type RowStatus = typeof STATUSES[number]
export type Cell = string | number | boolean | null
export interface Candidate {
  procedure_code: string
  procedure_name: string
  score?: number | null
  source?: string | null
}
export interface MigrationRow {
  id: number
  status: RowStatus
  procedure_code: string | null
  original_item: Cell
  original_price: Cell
  candidates: Candidate[]
  reason: string
  parsed_medication: { ingredient: string; strength: string[]; unit: string[]; dosage_form: string | null }
  audit: { who: string; when: string; action: string; from_status: RowStatus; to_status: RowStatus; selected_code: string | null }[]
}
export interface BatchStatus {
  batch_id: string
  state: 'UPLOADED' | 'CONFIGURED' | 'MATCHED' | 'FINALIZED'
  total: number
  counts: Partial<Record<RowStatus, number>>
  remaining: number
}
export interface UploadResult {
  batch_id: string
  sheets: string[]
  preview: Record<string, {
    columns: string[]
    rows: Record<string, Cell>[]
    error?: string
    suggested_column_mapping: { item_column: string | null; price_column: string | null }
  }>
}
export interface RowsResult { rows: MigrationRow[]; total: number; limit: number; offset: number }

export function originalValue(value: Cell): string { return value === null ? '' : String(value) }
export function reviewerName(user: { first_name?: string; last_name?: string; email?: string } | null): string {
  return [user?.first_name?.trim(), user?.last_name?.trim()].filter(Boolean).join(' ') || user?.email?.trim() || ''
}
export function suggestion(row: MigrationRow, catalog: Record<string, Candidate>): Candidate | undefined {
  if (!row.procedure_code) return row.candidates[0]
  // Human decisions retain the original suggestions; never attribute an old name/score to a new code.
  return row.candidates.find(c => c.procedure_code === row.procedure_code) || catalog[row.procedure_code]
}
export function errorMessage(body: unknown, status: number): string {
  const detail = body && typeof body === 'object' && 'detail' in body ? body.detail : body
  if (typeof detail === 'string') return detail
  if (detail && typeof detail === 'object' && 'remaining' in detail) {
    return `Finalization blocked: ${detail.remaining} item(s) still need human completion. Review pending items and check mapped codes before trying again.`
  }
  if (Array.isArray(detail)) return detail.map(d => typeof d?.msg === 'string' ? d.msg : 'Invalid request').join('; ')
  return `Request failed (${status}). Please try again.`
}
const BASE = `${(process.env.NEXT_PUBLIC_API_URL ?? '').replace(/\/$/, '')}/api/v1/tariff-migration`
export async function migrationRequest(path: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${BASE}${path}`, { ...init, cache: 'no-store' })
  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null)
    throw new Error(errorMessage(body, response.status))
  }
  return response
}
export async function migrationJson<T>(path: string, init?: RequestInit): Promise<T> {
  return (await migrationRequest(path, init)).json()
}
export function post(body?: object): RequestInit {
  return body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : { method: 'POST' }
}
