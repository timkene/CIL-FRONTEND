import type {
  MonitorStatus,
  SyncStatus,
  Escalation,
  EscalationStats,
  AftercareRecord,
  AftercareStats,
  AftercareOutreachRecord,
  AftercareTrackerRecord,
} from './pharmacy-types'

const BASE = process.env.NEXT_PUBLIC_KLAIRE_API_URL ?? ''
const SERVICE_KEY = process.env.NEXT_PUBLIC_KLAIRE_SERVICE_KEY ?? ''

export class KlaireApiError extends Error {
  constructor(public status: number, message: string) {
    super(message)
    this.name = 'KlaireApiError'
  }
}

async function klaireFetch<T>(
  path: string,
  init?: RequestInit,
  userName?: string
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Service-Key': SERVICE_KEY,
    ...(userName ? { 'X-Service-User': userName } : {}),
    ...(init?.headers as Record<string, string> | undefined),
  }
  const res = await fetch(`${BASE}${path}`, { ...init, headers })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new KlaireApiError(
      res.status,
      (data as { detail?: string }).detail ?? `HTTP ${res.status}`
    )
  }
  return data as T
}

// ── Monitor ────────────────────────────────────────────────────────────────────
export const getMonitorStatus = () =>
  klaireFetch<MonitorStatus>('/team/api/monitor/status')

export const startMonitor = (userName?: string) =>
  klaireFetch<{ status: string; enabled: boolean }>('/team/api/monitor/start', { method: 'POST' }, userName)

export const stopMonitor = (userName?: string) =>
  klaireFetch<{ status: string; enabled: boolean }>('/team/api/monitor/stop', { method: 'POST' }, userName)

// ── Aftercare ──────────────────────────────────────────────────────────────────
export const getAftercareStatus = () =>
  klaireFetch<MonitorStatus>('/team/api/aftercare/status')

export const startAftercare = (userName?: string) =>
  klaireFetch<{ status: string; enabled: boolean }>('/team/api/aftercare/start', { method: 'POST' }, userName)

export const stopAftercare = (userName?: string) =>
  klaireFetch<{ status: string; enabled: boolean }>('/team/api/aftercare/stop', { method: 'POST' }, userName)

export const getAftercareFeedback = (since?: string, until?: string) => {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const qs = params.toString()
  return klaireFetch<{ feedback: AftercareRecord[]; stats: AftercareStats }>(
    `/team/api/aftercare-feedback${qs ? `?${qs}` : ''}`
  )
}

export const getAftercareOutreach = (since?: string) => {
  const qs = since ? `?since=${encodeURIComponent(since)}` : ''
  return klaireFetch<{ outreach: AftercareOutreachRecord[] }>(
    `/team/api/aftercare-outreach${qs}`
  )
}

export const getAftercareTracker = (date?: string) => {
  const qs = date ? `?date=${encodeURIComponent(date)}` : ''
  return klaireFetch<{
    date: string
    total: number
    responded: number
    pending: number
    records: AftercareTrackerRecord[]
  }>(`/team/api/aftercare/tracker${qs}`)
}

export const getAftercareProviderRatings = (since?: string, until?: string) => {
  const params = new URLSearchParams()
  if (since) params.set('since', since)
  if (until) params.set('until', until)
  const qs = params.toString()
  return klaireFetch<{ ratings: { hospital: string; avg_rating: number | null; count: number }[] }>(
    `/team/api/aftercare/provider-ratings${qs ? `?${qs}` : ''}`
  )
}

// ── Escalations ────────────────────────────────────────────────────────────────
export const getEscalations = (status?: string, autoOutreach?: boolean) => {
  const params = new URLSearchParams()
  if (status) params.set('status', status)
  if (autoOutreach !== undefined) params.set('auto_outreach', String(autoOutreach))
  const qs = params.toString() ? `?${params.toString()}` : ''
  return klaireFetch<{ escalations: Escalation[] }>(`/team/api/escalations${qs}`)
}

export const getEscalationStats = () =>
  klaireFetch<EscalationStats>('/team/api/stats')

export const claimEscalation = (id: string, userName?: string) =>
  klaireFetch<{ status: string; claimed_by: string }>(
    `/team/api/escalations/${id}/claim`,
    { method: 'POST' },
    userName
  )

export const addEscalationNote = (id: string, text: string, userName?: string) =>
  klaireFetch<{ status: string }>(
    `/team/api/escalations/${id}/note`,
    { method: 'POST', body: JSON.stringify({ text }) },
    userName
  )

export const resolveEscalation = (id: string, userName?: string) =>
  klaireFetch<{ status: string; resolved_by: string }>(
    `/team/api/escalations/${id}/resolve`,
    { method: 'POST' },
    userName
  )

// ── Check-ins ──────────────────────────────────────────────────────────────────
export const getCheckIns = () =>
  klaireFetch<Record<string, unknown>>('/team/api/checkins')

export interface CheckInSummary {
  confirmid: string
  enrollee_id: string
  firstname: string
  whatsapp_phone: string
  providername: string
  dateadded: string
  minutes_elapsed: number
  messaged: boolean
  sent_at: string
  dealt_by: string | null
  dealt_at: string
}

export const dealCheckIn = (confirmid: string, userName?: string) =>
  klaireFetch<{ status: string; confirmid: string; dealt_by: string }>(
    `/team/api/checkins/deal`,
    { method: 'POST', body: JSON.stringify({ confirmid }) },
    userName
  )

// ── Sync ───────────────────────────────────────────────────────────────────────
export const getSyncStatus = () =>
  klaireFetch<SyncStatus>('/team/api/sync/status')

export const runSync = (userName?: string) =>
  klaireFetch<{ written: number; ok: boolean; triggered_by: string; at: string }>(
    '/team/api/sync/run',
    { method: 'POST' },
    userName
  )
