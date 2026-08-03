'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useAuth } from '@/components/AppShell'
import {
  getEscalations,
  getEscalationStats,
  claimEscalation,
  resolveEscalation,
  addEscalationNote,
  KlaireApiError,
} from '@/lib/klaire-api'
import type { Escalation, EscalationStats } from '@/lib/pharmacy-types'

const STATUS_STYLES: Record<string, string> = {
  open:     'bg-amber-50 text-amber-700 border border-amber-200',
  claimed:  'bg-[#137fec]/10 text-[#137fec] border border-[#137fec]/20',
  resolved: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
}

function NoteModal({
  escalationId,
  onSave,
  onClose,
}: {
  escalationId: string
  onSave: (id: string, text: string) => Promise<void>
  onClose: () => void
}) {
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Add Note</h3>
        <textarea
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#137fec] focus:ring-2 focus:ring-[#137fec]/20 resize-none"
          rows={4}
          placeholder="Enter your note…"
          value={text}
          onChange={e => setText(e.target.value)}
        />
        <div className="flex justify-end gap-3 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!text.trim() || saving}
            onClick={async () => {
              setSaving(true)
              await onSave(escalationId, text)
              onClose()
            }}
            className="px-4 py-2 rounded-lg bg-[#137fec] text-white text-sm font-semibold hover:bg-[#137fec]/90 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving…' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function EscalationsPage() {
  const { user } = useAuth()
  const userName = user ? `${user.first_name} ${user.last_name}` : undefined

  const [escalations, setEscalations] = useState<Escalation[]>([])
  const [stats, setStats] = useState<EscalationStats | null>(null)
  const [filter, setFilter] = useState<string>('open')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [noteFor, setNoteFor] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [expandedComplaints, setExpandedComplaints] = useState<Set<string>>(new Set())
  const loadGenRef = useRef(0)

  const load = useCallback(async () => {
    const gen = ++loadGenRef.current
    try {
      const isAftercare = filter === 'aftercare'
      const [{ escalations: escs }, sts] = await Promise.all([
        getEscalations(isAftercare ? undefined : filter || undefined, isAftercare ? true : undefined),
        getEscalationStats(),
      ])
      if (gen !== loadGenRef.current) return
      setEscalations(escs)
      setStats(sts)
    } catch (err) {
      if (gen !== loadGenRef.current) return
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to load escalations')
    } finally {
      if (gen === loadGenRef.current) setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    setLoading(true)
    load()
  }, [load])

  useEffect(() => {
    const id = setInterval(load, 10_000)
    return () => clearInterval(id)
  }, [load])

  const handleClaim = async (id: string) => {
    setActing(id)
    // Optimistic: move to claimed immediately
    setEscalations(prev =>
      filter === 'open'
        ? prev.filter(e => e.id !== id)
        : prev.map(e => e.id === id ? { ...e, status: 'claimed', claimed_by: userName ?? '' } : e)
    )
    try {
      await claimEscalation(id, userName)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to claim')
      load()
    } finally {
      setActing(null)
    }
  }

  const handleResolve = async (id: string) => {
    setActing(id)
    // Optimistic: remove from open/claimed views immediately
    setEscalations(prev =>
      filter === '' || filter === 'resolved'
        ? prev.map(e => e.id === id ? { ...e, status: 'resolved' } : e)
        : prev.filter(e => e.id !== id)
    )
    try {
      await resolveEscalation(id, userName)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to resolve')
      load()
    } finally {
      setActing(null)
    }
  }

  const handleNote = async (id: string, text: string) => {
    try {
      await addEscalationNote(id, text, userName)
    } catch (err) {
      setToast(err instanceof KlaireApiError ? err.message : 'Failed to save note')
    }
  }

  const statItems = stats
    ? [
        { label: 'Open', value: stats.open, color: 'text-amber-700' },
        { label: 'Claimed', value: stats.claimed, color: 'text-[#137fec]' },
        { label: 'Resolved Today', value: stats.resolved_today, color: 'text-emerald-700' },
        { label: 'Total', value: stats.total, color: 'text-slate-900' },
      ]
    : []

  return (
    <div className="p-8 space-y-6">
      {noteFor && (
        <NoteModal
          escalationId={noteFor}
          onSave={handleNote}
          onClose={() => setNoteFor(null)}
        />
      )}

      {toast && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-lg text-sm flex items-center justify-between">
          <span>{toast}</span>
          <button onClick={() => setToast(null)} className="text-rose-400 hover:text-rose-600 ml-4">✕</button>
        </div>
      )}

      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Escalations</h1>
        <p className="text-sm text-slate-500 mt-1">Enrollee complaints and escalations from Klaire</p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          {statItems.map(({ label, value, color }) => (
            <div key={label} className="bg-white border border-slate-200 rounded-lg p-5">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-3xl font-semibold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {[
          { key: 'open', label: 'Open' },
          { key: 'claimed', label: 'Claimed' },
          { key: 'resolved', label: 'Resolved' },
          { key: '', label: 'All' },
          { key: 'aftercare', label: '24hr Aftercare' },
        ].map(({ key, label }) => (
          <button
            key={key || 'all'}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              filter === key
                ? key === 'aftercare'
                  ? 'bg-violet-600 text-white'
                  : 'bg-[#137fec] text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-sm text-slate-400">Loading…</div>
        ) : escalations.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">No escalations found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  {['Enrollee', 'Phone', 'Complaint', 'Hospital', 'Level', 'Status', 'Claimed By', 'Created', 'Actions'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {escalations.map((esc, idx) => (
                  <tr key={esc.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold text-slate-900">{esc.enrollee_name}</p>
                      <p className="text-xs text-slate-400 font-mono">{esc.enrollee_id}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {esc.auto_outreach && (
                          <span className="text-[10px] font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded px-1.5 py-0.5 uppercase tracking-wide">
                            24hr aftercare
                          </span>
                        )}
                        {esc.type && esc.type !== 'general_complaint' && esc.type !== 'aftercare_complaint' && (
                          <span className="text-[10px] font-bold text-[#137fec] bg-[#137fec]/10 rounded px-1.5 py-0.5 uppercase tracking-wide">
                            {esc.type.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {esc.registered_phones?.length > 0 ? (
                        <div className="space-y-0.5">
                          {esc.registered_phones.map((p: string) => (
                            <a key={p} href={`tel:+${p}`} className="block text-xs font-mono text-[#137fec] hover:underline">
                              +{p}
                            </a>
                          ))}
                        </div>
                      ) : esc.phone ? (
                        <span className="text-xs font-mono text-slate-500">+{esc.phone}</span>
                      ) : (
                        <span className="text-slate-300 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      {esc.complaint ? (
                        <div>
                          <p className={`text-sm text-slate-700 ${expandedComplaints.has(esc.id) ? '' : 'line-clamp-2'}`}>
                            {esc.complaint}
                          </p>
                          {esc.complaint.length > 80 && (
                            <button
                              onClick={() => setExpandedComplaints(prev => {
                                const next = new Set(prev)
                                next.has(esc.id) ? next.delete(esc.id) : next.add(esc.id)
                                return next
                              })}
                              className="text-xs text-[#137fec] hover:underline mt-0.5"
                            >
                              {expandedComplaints.has(esc.id) ? 'Show less' : 'Show more'}
                            </button>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-300 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-600">{esc.hospital || '—'}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-slate-700">L{esc.level}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${STATUS_STYLES[esc.status] ?? ''}`}>
                        {esc.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{esc.claimed_by || '—'}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">
                      {new Date(esc.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {esc.status === 'open' && (
                          <button
                            onClick={() => handleClaim(esc.id)}
                            disabled={acting === esc.id}
                            className="text-xs font-semibold text-[#137fec] hover:underline disabled:opacity-40"
                          >
                            {acting === esc.id ? '…' : 'Claim'}
                          </button>
                        )}
                        {esc.status === 'claimed' && (
                          <button
                            onClick={() => handleResolve(esc.id)}
                            disabled={acting === esc.id}
                            className="text-xs font-semibold text-emerald-700 hover:underline disabled:opacity-40"
                          >
                            {acting === esc.id ? '…' : 'Resolve'}
                          </button>
                        )}
                        <button
                          onClick={() => setNoteFor(esc.id)}
                          className="text-xs font-semibold text-slate-500 hover:underline"
                        >
                          Note
                        </button>
                      </div>
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
