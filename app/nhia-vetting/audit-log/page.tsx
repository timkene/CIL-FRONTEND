'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { nhiaFetch } from '@/lib/nhia-fetch'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

interface AuditEvent {
  batch_id:          string
  batch_name:        string
  action:            string
  performed_by_id:   number
  performed_by_name: string
  performed_at:      string
  meta:              Record<string, unknown>
}

const ACTION_LABEL: Record<string, string> = {
  CREATE_BATCH:       'Created',
  SAVE_BATCH:         'Saved',
  DELETE_BATCH:       'Deleted',
  SUBMIT_FOR_VETTING: 'Submitted',
  ACCEPT_BATCH:       'Accepted',
  REJECT_BATCH:       'Rejected',
}

const ACTION_STYLE: Record<string, string> = {
  CREATE_BATCH:       'bg-slate-100 text-slate-600',
  SAVE_BATCH:         'bg-slate-100 text-slate-600',
  DELETE_BATCH:       'bg-rose-50 text-rose-700',
  SUBMIT_FOR_VETTING: 'bg-blue-50 text-blue-700',
  ACCEPT_BATCH:       'bg-emerald-50 text-emerald-700',
  REJECT_BATCH:       'bg-rose-50 text-rose-700',
}

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-NG', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export default function AuditLogPage() {
  const [events,  setEvents]  = useState<AuditEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [search,  setSearch]  = useState('')
  const [error,   setError]   = useState('')

  useEffect(() => {
    nhiaFetch(`${API}/api/v1/nhia/audit-log?limit=500`)
      .then(r => r.json())
      .then(d => setEvents(d.events ?? []))
      .catch(() => {
        setError('Failed to load audit events. Please try again.')
        setEvents([])
      })
      .finally(() => setLoading(false))
  }, [])

  const filtered = events.filter(e => {
    const q = search.toLowerCase()
    return (
      e.batch_name.toLowerCase().includes(q) ||
      e.performed_by_name.toLowerCase().includes(q) ||
      e.action.toLowerCase().includes(q)
    )
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">NHIA Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">All staff actions on NHIA claims batches</p>
        </div>
        <Link
          href="/nhia-vetting"
          className="px-4 py-2 text-sm font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          ← Batches
        </Link>
      </div>

      <div className="max-w-sm">
        <input
          type="text"
          placeholder="Search by batch, staff, or action…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#137fec]/30"
        />
      </div>

      {error && (
        <div className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <span
              className="material-symbols-outlined text-4xl text-[#137fec]"
              style={{ animation: 'spin 1s linear infinite' }}
            >
              progress_activity
            </span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 text-sm">No events found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Date / Time</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Action</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Batch</th>
                <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wide">Performed By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{fmtDate(e.performed_at)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${ACTION_STYLE[e.action] ?? 'bg-slate-100 text-slate-600'}`}>
                      {ACTION_LABEL[e.action] ?? e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/nhia-vetting/${e.batch_id}`}
                      className="text-[#137fec] hover:underline font-medium"
                    >
                      {e.batch_name || e.batch_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{e.performed_by_name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Showing {filtered.length} of {events.length} events
      </p>
    </div>
  )
}
