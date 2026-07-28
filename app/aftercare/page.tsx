'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AppShell'
import {
  getAftercareStatus,
  startAftercare,
  stopAftercare,
  getAftercareFeedback,
  getAftercareOutreach,
  getAftercareTracker,
  KlaireApiError,
} from '@/lib/klaire-api'
import type {
  MonitorStatus,
  AftercareRecord,
  AftercareStats,
  AftercareOutreachRecord,
  AftercareTrackerRecord,
} from '@/lib/pharmacy-types'

const INTERACTION_STYLES = {
  completed: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  escalated:  'bg-amber-50 text-amber-700 border border-amber-200',
  pending:    'bg-slate-100 text-slate-500',
}

const INTERACTION_LABEL = {
  completed: 'Completed',
  escalated:  'Escalated',
  pending:    'No reply',
}

function scoreChip(v: number | undefined | null, max: number) {
  if (v == null) return null
  const bad  = max === 5 ? v <= 2 : v <= 3
  const good = max === 5 ? v >= 4 : v >= 8
  const cls  = bad ? 'text-rose-600' : good ? 'text-emerald-700' : 'text-slate-700'
  return <span className={`font-semibold text-xs ${cls}`}>{v}/{max}</span>
}

export default function AftercarePage() {
  const { user } = useAuth()
  const userName = user ? `${user.first_name} ${user.last_name}` : undefined

  const [status, setStatus]       = useState<MonitorStatus | null>(null)
  const [stats, setStats]         = useState<AftercareStats | null>(null)
  const [tracker, setTracker]     = useState<{ total: number; responded: number; pending: number; records: AftercareTrackerRecord[] } | null>(null)
  const [outreach, setOutreach]   = useState<AftercareOutreachRecord[]>([])
  const [feedback, setFeedback]   = useState<AftercareRecord[]>([])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [loading, setLoading]     = useState(true)
  const [acting, setActing]       = useState(false)
  const [toast, setToast]         = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [statusResult, trackerResult, feedbackResult, outreachResult] = await Promise.all([
        getAftercareStatus(),
        getAftercareTracker(selectedDate),
        getAftercareFeedback(),
        getAftercareOutreach(),
      ])
      setStatus(statusResult)
      setTracker(trackerResult)
      setFeedback(feedbackResult.feedback)
      setStats(feedbackResult.stats)
      setOutreach(outreachResult.outreach)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to load aftercare data')
    } finally {
      setLoading(false)
    }
  }, [selectedDate])

  useEffect(() => { setLoading(true); load() }, [load])
  useEffect(() => {
    const id = setInterval(load, 30_000)
    return () => clearInterval(id)
  }, [load])

  const handleToggle = async (enable: boolean) => {
    setActing(true)
    try {
      const result = enable ? await startAftercare(userName) : await stopAftercare(userName)
      setStatus(prev => prev
        ? { ...prev, enabled: result.enabled, updated_by: userName }
        : { enabled: result.enabled, updated_by: userName }
      )
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to update aftercare')
    } finally {
      setActing(false)
    }
  }

  // Daily sent summary grouped by day
  const byDay: Record<string, number> = {}
  outreach.forEach(r => {
    const day = r.contacted_at ? r.contacted_at.slice(0, 10) : 'unknown'
    byDay[day] = (byDay[day] ?? 0) + 1
  })
  const sentDays = Object.entries(byDay).sort((a, b) => b[0].localeCompare(a[0]))

  return (
    <div className="p-8 space-y-6">
      {toast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">24hr Aftercare</h1>
        <p className="text-sm text-slate-500 mt-1">Post-visit follow-up surveys via Klaire on WhatsApp</p>
      </div>

      {/* Toggle */}
      <div className="bg-white border border-slate-200 rounded-lg p-6 flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Aftercare Surveys</h2>
          <p className="text-sm text-slate-500 mt-1">When active, Klaire texts each enrollee 24hrs after their PA visit.</p>
          {status?.updated_by && (
            <p className="text-xs text-slate-400 mt-2">Last changed by <span className="font-semibold">{status.updated_by}</span></p>
          )}
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-6">
          {loading ? <span className="text-sm text-slate-400">Loading…</span> : (
            <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-semibold ${status?.enabled ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-slate-100 text-slate-500'}`}>
              {status?.enabled ? '● Active' : '○ Inactive'}
            </span>
          )}
          <button
            onClick={() => handleToggle(!status?.enabled)}
            disabled={acting || loading}
            className={`px-4 py-2 rounded-lg font-semibold text-sm transition-colors disabled:opacity-50 ${status?.enabled ? 'bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200' : 'bg-[#137fec] text-white hover:bg-[#137fec]/90'}`}
          >
            {acting ? 'Working…' : status?.enabled ? 'Stop' : 'Start'}
          </button>
        </div>
      </div>

      {/* Survey stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Responses',       display: String(stats.count) },
            { label: 'Avg CSAT',        display: stats.avg_csat != null ? `${stats.avg_csat}/5` : '—' },
            { label: 'Avg Provider',    display: stats.avg_provider_rating != null ? `${stats.avg_provider_rating}/5` : '—' },
            { label: 'Avg Clearline',   display: stats.avg_clearline_rating != null ? `${stats.avg_clearline_rating}/5` : '—' },
            { label: 'Avg NPS',         display: stats.avg_nps != null ? `${stats.avg_nps}/10` : '—' },
            { label: 'Escalations',     display: String(stats.escalation_count), color: stats.escalation_count > 0 ? 'text-rose-600' : 'text-slate-900' },
          ].map(({ label, display, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-3xl font-semibold ${color ?? 'text-slate-900'}`}>{display}</p>
            </div>
          ))}
        </div>
      )}

      {/* Daily tracker */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Enrollee Tracker</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {tracker
                ? `${tracker.total} sent · ${tracker.responded} responded · ${tracker.pending} no reply`
                : 'All enrollees contacted on the selected day'}
            </p>
          </div>
          <input
            type="date"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setLoading(true) }}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-[#137fec]"
          />
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : !tracker || tracker.records.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No aftercare messages sent on this date.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Enrollee', 'Hospital', 'Sent At', 'Status', 'Survey Scores', 'Complaint'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tracker.records.map((row, idx) => (
                  <tr key={`${row.enrollee_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-800 font-mono">{row.enrollee_id}</p>
                      {row.phone && (
                        <a href={`tel:+${row.phone}`} className="text-xs text-[#137fec] hover:underline font-mono">
                          +{row.phone}
                        </a>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600 max-w-[160px] truncate">
                      {row.providername || row.provider_name || '—'}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                      {row.contacted_at ? new Date(row.contacted_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${INTERACTION_STYLES[row.interaction]}`}>
                        {INTERACTION_LABEL[row.interaction]}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {row.feedback ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-slate-400">CSAT</span>{scoreChip(row.feedback.csat, 5)}
                          <span className="text-slate-300">·</span>
                          <span className="text-slate-400">NPS</span>{scoreChip(row.feedback.nps, 10)}
                        </div>
                      ) : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {row.escalation?.complaint
                        ? <p className="text-xs text-amber-700 line-clamp-2">{row.escalation.complaint}</p>
                        : <span className="text-slate-300 text-xs">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Messages sent — daily count */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Messages Sent</h2>
            <p className="text-xs text-slate-400 mt-0.5">Daily count of aftercare surveys dispatched</p>
          </div>
          {!loading && <span className="text-xs text-slate-400">{outreach.length} total</span>}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : sentDays.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No aftercare messages sent yet.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sentDays.map(([day, count]) => (
              <button
                key={day}
                onClick={() => setSelectedDate(day)}
                className={`w-full px-6 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left ${selectedDate === day ? 'bg-[#137fec]/5' : ''}`}
              >
                <span className={`text-sm font-medium ${selectedDate === day ? 'text-[#137fec]' : 'text-slate-700'}`}>
                  {new Date(day + 'T12:00:00').toLocaleDateString([], { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
                <span className={`text-sm font-semibold px-3 py-0.5 rounded-full ${selectedDate === day ? 'bg-[#137fec] text-white' : 'bg-[#137fec]/10 text-[#137fec]'}`}>
                  {count} sent
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
