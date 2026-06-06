'use client'
import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { Button, Badge, Modal, useToast } from '@/components/ui'

const API = process.env.NEXT_PUBLIC_NHIA_API_URL || 'http://localhost:8005'

// ── Types ─────────────────────────────────────────────────────────────────────

interface LearningEntry {
  _collection: string
  _label:      string
  _trusted:    boolean
  _status:     'Trusted' | 'Pending'
  // Procedure-Diagnosis
  procedure_code?:  string
  diagnosis_code?:  string
  is_valid_match?:  boolean
  match_reason?:    string
  // Procedure/Diagnosis Age
  min_age?:         number
  max_age?:         number
  is_valid_for_age?: boolean
  reason?:          string
  // Procedure/Diagnosis Gender
  gender?:          string
  is_valid_for_gender?: boolean
  // Procedure Class
  procedure_code_1?: string
  procedure_code_2?: string
  shared_class?:     string
  same_class?:       boolean
  // Specialist-Diagnosis
  specialist_code?: string
  // Common
  ai_confidence?:   number
  ai_reasoning?:    string
  approved_by?:     string
  admin_approved?:  boolean
  usage_count?:     number
  created_at?:      string
  last_used_date?:  string
}

interface EditState {
  entry:       LearningEntry
  reasoning:   string
  decision:    boolean | null
  approved:    boolean
}

// ── Collection config ─────────────────────────────────────────────────────────

type CollectionKey =
  | 'ai_human_procedure_diagnosis'
  | 'ai_human_procedure_age'
  | 'ai_human_procedure_gender'
  | 'ai_human_diagnosis_age'
  | 'ai_human_diagnosis_gender'
  | 'ai_human_procedure_class'
  | 'ai_specialist_diagnosis'

interface ColConfig {
  label:         string
  color:         string
  decisionField: 'is_valid_match' | 'is_valid_for_age' | 'is_valid_for_gender' | 'same_class'
  reasonField:   'match_reason' | 'reason' | 'ai_reasoning'
  keySummary:    (e: LearningEntry) => string
  filterDoc:     (e: LearningEntry) => Record<string, unknown>
}

const COL_CONFIG: Record<CollectionKey, ColConfig> = {
  ai_human_procedure_diagnosis: {
    label:         'Proc-Diagnosis',
    color:         'bg-violet-50 text-violet-700 border-violet-200',
    decisionField: 'is_valid_match',
    reasonField:   'match_reason',
    keySummary:    e => `${e.procedure_code} + ${e.diagnosis_code}`,
    filterDoc:     e => ({ procedure_code: e.procedure_code, diagnosis_code: e.diagnosis_code }),
  },
  ai_human_procedure_age: {
    label:         'Proc Age',
    color:         'bg-sky-50 text-sky-700 border-sky-200',
    decisionField: 'is_valid_for_age',
    reasonField:   'reason',
    keySummary:    e => `${e.procedure_code} · age ${e.min_age}–${e.max_age}`,
    filterDoc:     e => ({ procedure_code: e.procedure_code, min_age: e.min_age, max_age: e.max_age }),
  },
  ai_human_procedure_gender: {
    label:         'Proc Gender',
    color:         'bg-pink-50 text-pink-700 border-pink-200',
    decisionField: 'is_valid_for_gender',
    reasonField:   'reason',
    keySummary:    e => `${e.procedure_code} · ${e.gender}`,
    filterDoc:     e => ({ procedure_code: e.procedure_code, gender: e.gender }),
  },
  ai_human_diagnosis_age: {
    label:         'Diag Age',
    color:         'bg-amber-50 text-amber-700 border-amber-200',
    decisionField: 'is_valid_for_age',
    reasonField:   'reason',
    keySummary:    e => `${e.diagnosis_code} · age ${e.min_age}–${e.max_age}`,
    filterDoc:     e => ({ diagnosis_code: e.diagnosis_code, min_age: e.min_age, max_age: e.max_age }),
  },
  ai_human_diagnosis_gender: {
    label:         'Diag Gender',
    color:         'bg-orange-50 text-orange-700 border-orange-200',
    decisionField: 'is_valid_for_gender',
    reasonField:   'reason',
    keySummary:    e => `${e.diagnosis_code} · ${e.gender}`,
    filterDoc:     e => ({ diagnosis_code: e.diagnosis_code, gender: e.gender }),
  },
  ai_human_procedure_class: {
    label:         'Proc Class',
    color:         'bg-teal-50 text-teal-700 border-teal-200',
    decisionField: 'same_class',
    reasonField:   'ai_reasoning',
    keySummary:    e => `${e.procedure_code_1} + ${e.procedure_code_2}`,
    filterDoc:     e => ({ procedure_code_1: e.procedure_code_1, procedure_code_2: e.procedure_code_2 }),
  },
  ai_specialist_diagnosis: {
    label:         'Specialist-Diag',
    color:         'bg-indigo-50 text-indigo-700 border-indigo-200',
    decisionField: 'is_valid_match',
    reasonField:   'match_reason',
    keySummary:    e => `${e.specialist_code} + ${e.diagnosis_code}`,
    filterDoc:     e => ({ specialist_code: e.specialist_code, diagnosis_code: e.diagnosis_code }),
  },
}

const ALL_COLLECTIONS = Object.keys(COL_CONFIG) as CollectionKey[]

function getConfig(col: string): ColConfig | undefined {
  return COL_CONFIG[col as CollectionKey]
}

function getDecision(e: LearningEntry): boolean | null {
  const cfg = getConfig(e._collection)
  if (!cfg) return null
  const val = e[cfg.decisionField as keyof LearningEntry]
  return val == null ? null : (val as boolean)
}

function getReason(e: LearningEntry): string {
  const cfg = getConfig(e._collection)
  if (!cfg) return e.ai_reasoning ?? ''
  return (e[cfg.reasonField as keyof LearningEntry] as string) ?? e.ai_reasoning ?? ''
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function DecisionBadge({ value }: { value: boolean | null }) {
  if (value === null) return <span className="text-slate-400 text-xs">—</span>
  return <Badge variant={value ? 'success' : 'error'} size="sm">{value ? 'Valid' : 'Invalid'}</Badge>
}

function TrustBadge({ trusted }: { trusted: boolean }) {
  return <Badge variant={trusted ? 'success' : 'warning'} size="sm">{trusted ? 'Trusted' : 'Pending'}</Badge>
}

function TypeBadge({ col }: { col: string }) {
  const cfg = getConfig(col)
  if (!cfg) return <span className="text-xs text-slate-400">{col}</span>
  return (
    <span className={`inline-flex px-2 py-0.5 rounded-full border text-xs font-medium ${cfg.color}`}>
      {cfg.label}
    </span>
  )
}

const TABS = [
  { key: '', label: 'All' },
  ...ALL_COLLECTIONS.map(k => ({ key: k, label: COL_CONFIG[k].label })),
]

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function LearningDatabasePage() {
  const toast = useToast()
  const [entries,     setEntries]     = useState<LearningEntry[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [tab,         setTab]         = useState('')
  const [statusFilter,setStatusFilter]= useState<'' | 'trusted' | 'pending'>('')
  const [search,      setSearch]      = useState('')
  const [editState,   setEditState]   = useState<EditState | null>(null)
  const [deleteEntry, setDeleteEntry] = useState<LearningEntry | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [deleting,    setDeleting]    = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (tab)          params.set('collection', tab)
      if (statusFilter) params.set('status', statusFilter)
      if (search)       params.set('search', search)
      const res  = await fetch(`${API}/api/v1/learning?${params}`)
      const data = await res.json()
      setEntries(data.entries ?? [])
    } catch {
      setError('Failed to load learning data')
    } finally {
      setLoading(false)
    }
  }, [tab, statusFilter, search])

  useEffect(() => { load() }, [load])

  // ── Edit ───────────────────────────────────────────────────────────────────

  function openEdit(e: LearningEntry) {
    setEditState({
      entry:     e,
      reasoning: getReason(e),
      decision:  getDecision(e),
      approved:  e.admin_approved ?? false,
    })
  }

  async function saveEdit() {
    if (!editState) return
    const { entry, reasoning, decision, approved } = editState
    const cfg = getConfig(entry._collection)
    if (!cfg) return
    setSaving(true)
    try {
      const updates: Record<string, unknown> = { admin_approved: approved }
      if (cfg.reasonField === 'match_reason') updates.match_reason = reasoning
      else if (cfg.reasonField === 'reason')  updates.reason       = reasoning
      else                                    updates.ai_reasoning = reasoning

      if (decision !== null) updates[cfg.decisionField] = decision

      await fetch(`${API}/api/v1/learning/${entry._collection}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filter_doc: cfg.filterDoc(entry), updates }),
      })
      toast.success('Learning entry updated successfully')
      setEditState(null)
      load()
    } catch {
      toast.error('Failed to update entry')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────

  async function confirmDelete() {
    if (!deleteEntry) return
    const cfg = getConfig(deleteEntry._collection)
    if (!cfg) return
    setDeleting(true)
    try {
      await fetch(`${API}/api/v1/learning/${deleteEntry._collection}/delete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ filter_doc: cfg.filterDoc(deleteEntry) }),
      })
      toast.success('Learning entry deleted successfully')
      setDeleteEntry(null)
      load()
    } catch {
      toast.error('Failed to delete entry')
    } finally {
      setDeleting(false)
    }
  }

  // ── Stats ──────────────────────────────────────────────────────────────────

  const total   = entries.length
  const trusted = entries.filter(e => e._trusted).length
  const pending = total - trusted

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
              <Link href="/nhia-vetting" className="hover:text-[#137fec]">NHIA Vetting</Link>
              <span>/</span>
              <span className="text-slate-600">Learning Database</span>
            </div>
            <h1 className="text-xl font-bold text-slate-800">Learning Database</h1>
            <p className="text-xs text-slate-500 mt-0.5">All AI-learned decisions — review, edit or delete</p>
          </div>
          <div className="flex gap-4 text-center">
            <div className="px-4 py-2 rounded-lg bg-slate-50 border border-slate-200">
              <p className="text-xl font-bold text-slate-800">{total}</p>
              <p className="text-xs text-slate-500">Total</p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-emerald-50 border border-emerald-200">
              <p className="text-xl font-bold text-emerald-700">{trusted}</p>
              <p className="text-xs text-emerald-600">Trusted</p>
            </div>
            <div className="px-4 py-2 rounded-lg bg-amber-50 border border-amber-200">
              <p className="text-xl font-bold text-amber-700">{pending}</p>
              <p className="text-xs text-amber-600">Pending</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 flex-wrap">
          {TABS.map(t => (
            <Button
              key={t.key}
              variant={tab === t.key ? 'primary' : 'outline'}
              size="sm"
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </Button>
          ))}
        </div>

        {/* Filters */}
        <div className="flex gap-3 items-center flex-wrap">
          <input
            type="text"
            placeholder="Search codes, reasoning..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] w-64"
          />
          <div className="flex gap-1">
            {(['', 'trusted', 'pending'] as const).map(s => (
              <Button
                key={s}
                variant={statusFilter === s ? 'secondary' : 'outline'}
                size="sm"
                onClick={() => setStatusFilter(s)}
              >
                {s === '' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
              </Button>
            ))}
          </div>
          <Button variant="outline" size="sm" onClick={load} className="ml-auto">
            Refresh
          </Button>
        </div>

        {/* Table */}
        {error && <p className="text-sm text-rose-500">{error}</p>}

        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">Loading...</div>
        ) : entries.length === 0 ? (
          <div className="flex items-center justify-center py-16 text-slate-400 text-sm">No entries found</div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                    <th className="text-left px-4 py-3 font-semibold">Type</th>
                    <th className="text-left px-4 py-3 font-semibold">Key</th>
                    <th className="text-left px-4 py-3 font-semibold">Decision</th>
                    <th className="text-left px-4 py-3 font-semibold">Confidence</th>
                    <th className="text-left px-4 py-3 font-semibold">Uses</th>
                    <th className="text-left px-4 py-3 font-semibold">Status</th>
                    <th className="text-left px-4 py-3 font-semibold">Approved By</th>
                    <th className="text-right px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => {
                    const cfg      = getConfig(e._collection)
                    const decision = getDecision(e)
                    const reason   = getReason(e)
                    return (
                      <tr key={i} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3">
                          <TypeBadge col={e._collection} />
                        </td>
                        <td className="px-4 py-3">
                          <span className="font-mono text-xs text-slate-700">
                            {cfg ? cfg.keySummary(e) : '—'}
                          </span>
                          {reason && (
                            <p className="text-xs text-slate-400 mt-0.5 max-w-xs truncate" title={reason}>{reason}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <DecisionBadge value={decision} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {e.ai_confidence != null ? `${e.ai_confidence}%` : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          {e.usage_count ?? 0}
                        </td>
                        <td className="px-4 py-3">
                          <TrustBadge trusted={e._trusted} />
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">
                          {e.approved_by ?? '—'}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2 justify-end">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(e)}>
                              Edit
                            </Button>
                            <Button variant="danger" size="sm" onClick={() => setDeleteEntry(e)}>
                              Delete
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={!!editState}
        onClose={() => setEditState(null)}
        title="Edit Learning Entry"
        size="md"
      >
        {editState && (
          <div className="space-y-4">

            {/* Key summary */}
            <div className="bg-slate-50 rounded-lg p-3 text-xs">
              <p className="text-slate-500 mb-1">Entry</p>
              <TypeBadge col={editState.entry._collection} />
              <p className="font-mono text-slate-700 mt-1">
                {getConfig(editState.entry._collection)?.keySummary(editState.entry)}
              </p>
            </div>

            {/* Decision toggle */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Decision</label>
              <div className="flex gap-2">
                {([true, false] as const).map(v => (
                  <button
                    key={String(v)}
                    onClick={() => setEditState(s => s ? { ...s, decision: v } : s)}
                    className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                      editState.decision === v
                        ? v ? 'bg-emerald-500 text-white border-emerald-500'
                            : 'bg-rose-500 text-white border-rose-500'
                        : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {v ? 'Valid' : 'Invalid'}
                  </button>
                ))}
              </div>
            </div>

            {/* Reasoning */}
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">Reasoning / Notes</label>
              <textarea
                value={editState.reasoning}
                onChange={e => setEditState(s => s ? { ...s, reasoning: e.target.value } : s)}
                rows={4}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec]/30 focus:border-[#137fec] resize-none"
              />
            </div>

            {/* Trust toggle */}
            <div className="flex items-center gap-3">
              <button
                onClick={() => setEditState(s => s ? { ...s, approved: !s.approved } : s)}
                className={`relative w-10 h-5 rounded-full transition-colors ${editState.approved ? 'bg-emerald-500' : 'bg-slate-300'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${editState.approved ? 'left-5' : 'left-0.5'}`} />
              </button>
              <span className="text-xs font-medium text-slate-600">
                Mark as Trusted {editState.approved ? '(auto-decisions enabled)' : '(pending — AI asks each time)'}
              </span>
            </div>

            <div className="flex gap-3 pt-1">
              <Button variant="secondary" onClick={() => setEditState(null)} className="flex-1">
                Cancel
              </Button>
              <Button variant="primary" onClick={saveEdit} disabled={saving} className="flex-1">
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Delete Confirmation ────────────────────────────────────────────── */}
      <Modal
        open={!!deleteEntry}
        onClose={() => setDeleteEntry(null)}
        title="Delete Entry?"
        size="sm"
      >
        {deleteEntry && (
          <div className="space-y-4">
            <div className="bg-rose-50 rounded-lg p-3 text-xs">
              <TypeBadge col={deleteEntry._collection} />
              <p className="font-mono text-slate-700 mt-1">
                {getConfig(deleteEntry._collection)?.keySummary(deleteEntry)}
              </p>
            </div>
            <p className="text-sm text-slate-500">
              This removes the learned decision permanently. The next matching case will go back to AI validation.
            </p>
            <div className="flex gap-3">
              <Button variant="secondary" onClick={() => setDeleteEntry(null)} className="flex-1">
                Cancel
              </Button>
              <Button variant="danger" onClick={confirmDelete} disabled={deleting} className="flex-1">
                {deleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
