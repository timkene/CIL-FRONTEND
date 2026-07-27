'use client'
import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/components/AppShell'
import {
  getAftercareStatus,
  startAftercare,
  stopAftercare,
  getAftercareFeedback,
  getAftercareOutreach,
  KlaireApiError,
} from '@/lib/klaire-api'
import type { MonitorStatus, AftercareRecord, AftercareStats, AftercareOutreachRecord } from '@/lib/pharmacy-types'


export default function AftercarePage() {
  const { user } = useAuth()
  const userName = user ? `${user.first_name} ${user.last_name}` : undefined

  const [status, setStatus] = useState<MonitorStatus | null>(null)
  const [feedback, setFeedback] = useState<AftercareRecord[]>([])
  const [outreach, setOutreach] = useState<AftercareOutreachRecord[]>([])
  const [stats, setStats] = useState<AftercareStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      const [statusResult, feedbackResult, outreachResult] = await Promise.all([
        getAftercareStatus(),
        getAftercareFeedback(),
        getAftercareOutreach(),
      ])
      setStatus(statusResult)
      setFeedback(feedbackResult.feedback)
      setStats(feedbackResult.stats)
      setOutreach(outreachResult.outreach)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to load aftercare data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

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
        <p className="text-sm text-slate-500 mt-1">Klaire 24-hour post-visit follow-up surveys via WhatsApp</p>
      </div>

      {/* Toggle card */}
      <div className="bg-white border border-slate-200 rounded-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Aftercare Surveys</h2>
            <p className="text-sm text-slate-500 mt-1">
              When active, Klaire sends a follow-up survey 24 hours after each PA visit.
            </p>
            {status?.updated_by && (
              <p className="text-xs text-slate-400 mt-2">
                Last changed by <span className="font-semibold">{status.updated_by}</span>
              </p>
            )}
          </div>
          <div className="flex items-center gap-3 shrink-0 ml-6">
            {loading ? (
              <span className="text-sm text-slate-400">Loading…</span>
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
              onClick={() => handleToggle(!status?.enabled)}
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

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: 'Responses', value: stats.count, display: String(stats.count) },
            { label: 'Avg CSAT', value: stats.avg_csat, display: stats.avg_csat != null ? `${stats.avg_csat}/5` : '—' },
            { label: 'Avg Provider', value: stats.avg_provider_rating, display: stats.avg_provider_rating != null ? `${stats.avg_provider_rating}/5` : '—' },
            { label: 'Avg Clearline', value: stats.avg_clearline_rating, display: stats.avg_clearline_rating != null ? `${stats.avg_clearline_rating}/5` : '—' },
            { label: 'Avg NPS', value: stats.avg_nps, display: stats.avg_nps != null ? `${stats.avg_nps}/10` : '—' },
            { label: 'Escalations', value: stats.escalation_count, display: String(stats.escalation_count), color: stats.escalation_count > 0 ? 'text-rose-600' : 'text-slate-900' },
          ].map(({ label, display, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-3xl font-semibold ${color ?? 'text-slate-900'}`}>{display}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sent log */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Messages Sent (24hrs)</h2>
            <p className="text-xs text-slate-400 mt-0.5">Enrollees Klaire has contacted for aftercare follow-up</p>
          </div>
          {!loading && (
            <span className="text-xs text-slate-400">{outreach.length} sent</span>
          )}
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : outreach.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No aftercare messages sent in the last 24 hours.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Enrollee ID', 'Hospital', 'Visit Date', 'Phone', 'Sent At'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {outreach.map((row, idx) => (
                  <tr key={`${row.pa_key}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3 font-mono text-sm text-slate-700">{row.enrollee_id}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{row.providername || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{row.visit_date || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-500">{row.phone || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {row.contacted_at ? new Date(row.contacted_at).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Feedback table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Recent Feedback</h2>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : feedback.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No feedback received yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Enrollee ID', 'Hospital', 'CSAT', 'Provider', 'Clearline', 'NPS', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {feedback.map((row, idx) => {
                  const scoreCell = (v: number | null, max: number) =>
                    v != null
                      ? <span className={`font-semibold ${v <= (max === 5 ? 2 : 4) ? 'text-rose-600' : v >= (max === 5 ? 4 : 8) ? 'text-emerald-700' : 'text-slate-700'}`}>{v}/{max}</span>
                      : <span className="text-slate-300">—</span>
                  return (
                    <tr key={`${row.enrollee_id}-${idx}`} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                      <td className="px-4 py-3 font-mono text-sm text-slate-700">{row.enrollee_id || '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 max-w-[160px] truncate">{row.provider_name || '—'}</td>
                      <td className="px-4 py-3 text-sm">{scoreCell(row.csat, 5)}</td>
                      <td className="px-4 py-3 text-sm">{scoreCell(row.provider_rating, 5)}</td>
                      <td className="px-4 py-3 text-sm">{scoreCell(row.clearline_rating, 5)}</td>
                      <td className="px-4 py-3 text-sm">{scoreCell(row.nps, 10)}</td>
                      <td className="px-4 py-3 text-sm text-slate-400 whitespace-nowrap">
                        {new Date(row.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
