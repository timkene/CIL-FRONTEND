'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AppShell'
import {
  getMonitorStatus,
  startMonitor,
  stopMonitor,
  getSyncStatus,
  runSync,
  getCheckIns,
  dealCheckIn,
  KlaireApiError,
  type CheckInSummary,
} from '@/lib/klaire-api'
import type { MonitorStatus, SyncStatus } from '@/lib/pharmacy-types'

const NHIA_API = process.env.NEXT_PUBLIC_NHIA_API_URL ?? ''

async function fetchClearlinePhone(enrolleeId: string): Promise<string> {
  if (!enrolleeId || !NHIA_API) return ''
  try {
    const res = await fetch(`${NHIA_API}/api/members/${encodeURIComponent(enrolleeId)}`)
    if (!res.ok) return ''
    const data = await res.json()
    return (data as { phone?: string }).phone ?? ''
  } catch {
    return ''
  }
}

function ToggleCard({
  title,
  description,
  status,
  onStart,
  onStop,
  loading,
  acting,
}: {
  title: string
  description: string
  status: MonitorStatus | null
  onStart: () => void
  onStop: () => void
  loading: boolean
  acting: boolean
}) {
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500 mt-1">{description}</p>
          {status?.updated_by && (
            <p className="text-xs text-slate-400 mt-2">
              Last changed by <span className="font-semibold">{status.updated_by}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-6">
          {loading ? (
            <span className="inline-flex items-center px-3 py-1.5 rounded-lg bg-slate-100 text-slate-400 text-sm">Loading…</span>
          ) : (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${
              status?.enabled
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-slate-100 text-slate-500'
            }`}>
              {status?.enabled ? '● Active' : '○ Inactive'}
            </span>
          )}
          <button
            onClick={status?.enabled ? onStop : onStart}
            disabled={acting || loading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${
              status?.enabled
                ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200'
                : 'bg-[#137fec] text-white hover:bg-[#137fec]/90'
            }`}
          >
            {acting ? 'Working…' : status?.enabled ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CheckInPage() {
  const { user } = useAuth()
  const userName = user ? `${user.first_name} ${user.last_name}` : undefined

  const [monitorStatus, setMonitorStatus] = useState<MonitorStatus | null>(null)
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null)
  const [checkins, setCheckins] = useState<CheckInSummary[]>([])
  const [clearlinePhones, setClearlinePhones] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [actingMonitor, setActingMonitor] = useState(false)
  const [actingSync, setActingSync] = useState(false)
  const [dealing, setDealing] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [monitor, sync, ci] = await Promise.all([
        getMonitorStatus(),
        getSyncStatus(),
        getCheckIns(),
      ])
      setMonitorStatus(monitor)
      setSyncStatus(sync)
      // Extract list from whatever shape the checkins response has
      const rows = Array.isArray(ci)
        ? (ci as CheckInSummary[])
        : (ci.summary as CheckInSummary[] | undefined)
          ?? (ci.data as CheckInSummary[] | undefined)
          ?? (ci.checkins as CheckInSummary[] | undefined)
          ?? []
      setCheckins(rows)

      // Fetch Clearline-registered phones from NHIA API concurrently
      const messagedRows = rows.filter((r) => r.messaged && r.enrollee_id)
      const pairs = await Promise.allSettled(
        messagedRows.map(async (r) => {
          const ph = await fetchClearlinePhone(r.enrollee_id)
          return [r.enrollee_id, ph] as [string, string]
        })
      )
      const phoneMap: Record<string, string> = {}
      for (const p of pairs) {
        if (p.status === 'fulfilled' && p.value[1]) phoneMap[p.value[0]] = p.value[1]
      }
      setClearlinePhones(phoneMap)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to load check-in data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const handleMonitorToggle = async (enable: boolean) => {
    setActingMonitor(true)
    try {
      const result = enable ? await startMonitor(userName) : await stopMonitor(userName)
      setMonitorStatus(prev => prev ? { ...prev, enabled: result.enabled, updated_by: userName } : { enabled: result.enabled, updated_by: userName })
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to update monitor')
    } finally {
      setActingMonitor(false)
    }
  }

  const handleDeal = async (confirmid: string) => {
    setDealing(confirmid)
    try {
      const result = await dealCheckIn(confirmid, userName)
      setCheckins(prev => prev.map(c =>
        c.confirmid === confirmid ? { ...c, dealt_by: result.dealt_by, dealt_at: new Date().toISOString() } : c
      ))
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to mark as dealt')
    } finally {
      setDealing(null)
    }
  }

  const handleSync = async () => {
    setActingSync(true)
    try {
      await runSync(userName)
      await load()
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Sync failed')
    } finally {
      setActingSync(false)
    }
  }

  return (
    <div className="p-8 space-y-6">
      {toast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Check-in Monitor</h1>
        <p className="text-sm text-slate-500 mt-1">Klaire proactive check-in messages via WhatsApp</p>
      </div>

      <ToggleCard
        title="Proactive Check-in"
        description="When active, Klaire sends WhatsApp check-in messages to enrollees based on MediCloud visit data."
        status={monitorStatus}
        onStart={() => handleMonitorToggle(true)}
        onStop={() => handleMonitorToggle(false)}
        loading={loading}
        acting={actingMonitor}
      />

      {/* Sync status */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">MediCloud Sync</h2>
            <p className="text-sm text-slate-500 mt-1">{syncStatus?.schedule ?? 'Auto-sync every 5 minutes'}</p>
          </div>
          <button
            onClick={handleSync}
            disabled={actingSync || loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>sync</span>
            {actingSync ? 'Syncing…' : 'Sync Now'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Records in Atlas</p>
            <p className="text-2xl font-semibold text-slate-900">
              {loading ? '—' : (syncStatus?.checkin_presence_count ?? '—').toLocaleString()}
            </p>
          </div>
          <div className="bg-slate-50 rounded-lg p-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Latest Check-in</p>
            <p className="text-sm font-semibold text-slate-700">
              {loading ? '—' : syncStatus?.latest_checkin
                ? new Date(syncStatus.latest_checkin).toLocaleString()
                : 'No data yet'}
            </p>
          </div>
        </div>

        {syncStatus?.last_sync && Object.keys(syncStatus.last_sync).length > 0 && (
          <div className="mt-4 border-t border-slate-100 pt-4">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Last Manual Sync</p>
            <div className="flex items-center gap-4 text-sm">
              <span className={`font-semibold ${syncStatus.last_sync.ok ? 'text-emerald-700' : 'text-rose-600'}`}>
                {syncStatus.last_sync.ok ? '✓ Success' : '✗ Failed'}
              </span>
              {syncStatus.last_sync.written != null && (
                <span className="text-slate-500">{syncStatus.last_sync.written} records written</span>
              )}
              {syncStatus.last_sync.triggered_by && (
                <span className="text-slate-500">by {syncStatus.last_sync.triggered_by}</span>
              )}
              {syncStatus.last_sync.at && (
                <span className="text-slate-400">{new Date(syncStatus.last_sync.at).toLocaleString()}</span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Check-ins table — only rows Klaire has messaged today */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900">Messaged Today</h2>
          {!loading && (
            <span className="text-xs text-slate-400">{checkins.filter(c => c.messaged).length} sent</span>
          )}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : checkins.filter(c => c.messaged).length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No check-in messages sent today yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Enrollee ID', 'Name', 'Contact Numbers', 'Hospital', 'Check-in Time', 'Messaged At', 'Dealt By', ''].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {checkins.filter(c => c.messaged).map((ci, idx) => (
                  <tr key={ci.confirmid} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{ci.enrollee_id || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{ci.firstname || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex flex-col gap-1">
                        {ci.phone && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase w-16 shrink-0">WhatsApp</span>
                            <a href={`tel:${ci.phone}`} className="font-mono text-slate-700 hover:text-[#137fec] hover:underline">{ci.phone}</a>
                          </div>
                        )}
                        {(ci.extra_phones ?? []).map((p, i) => (
                          <div key={i} className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-slate-400 uppercase w-16 shrink-0">Alt {i + 1}</span>
                            <a href={`tel:${p}`} className="font-mono text-slate-700 hover:text-[#137fec] hover:underline">{p}</a>
                          </div>
                        ))}
                        {clearlinePhones[ci.enrollee_id] && clearlinePhones[ci.enrollee_id] !== ci.phone && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] font-bold text-emerald-600 uppercase w-16 shrink-0">On File</span>
                            <a href={`tel:${clearlinePhones[ci.enrollee_id]}`} className="font-mono text-emerald-700 hover:underline">{clearlinePhones[ci.enrollee_id]}</a>
                          </div>
                        )}
                        {!ci.phone && !clearlinePhones[ci.enrollee_id] && <span className="text-slate-300">—</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{ci.providername || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {ci.dateadded ? new Date(ci.dateadded).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {ci.sent_at ? new Date(ci.sent_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {ci.dealt_by ? (
                        <span className="text-emerald-700 font-semibold">{ci.dealt_by}</span>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {!ci.dealt_by ? (
                        <button
                          disabled={dealing === ci.confirmid}
                          onClick={() => handleDeal(ci.confirmid)}
                          className="text-xs font-semibold text-[#137fec] hover:underline disabled:opacity-40 whitespace-nowrap"
                        >
                          {dealing === ci.confirmid ? '…' : 'Pick Up'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-300">Done</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
