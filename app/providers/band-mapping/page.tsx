'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AppShell'
import { isAdmin } from '@/lib/auth'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MappingFlag {
  id: number
  enrollee_id: string
  full_name: string | null
  plan_name: string | null
  plan_code: string | null
  individual_price: number | null
  family_price: number | null
  allowed_bands: string | null
  mapped_provider_id: string | null
  mapped_provider_name: string | null
  mapped_provider_band: string | null
  flag_reason: string | null
  contract_end_date: string | null
  scanned_at: string
}

interface VisitFlag {
  id: number
  enrollee_id: string
  full_name: string | null
  plan_name: string | null
  individual_price: number | null
  family_price: number | null
  allowed_bands: string | null
  visit_count_higher_band: number
  last_visit_date: string | null
  higher_band_providers: string | null
  contract_end_date: string | null
  scanned_at: string
}

interface Decision {
  id: number
  enrollee_id: string
  full_name: string | null
  plan_name: string | null
  individual_price: number | null
  family_price: number | null
  allowed_bands: string | null
  mapped_provider_name: string | null
  mapped_provider_band: string | null
  higher_band_providers: string | null
  flag_type: string
  decision: DecisionType
  decided_by_name: string | null
  decided_by_dept: string | null
  decided_at: string
  contract_end_date: string | null
  notes: string | null
}

type DecisionType = 'exceptional_approved' | 'reband_immediately' | 'reband_at_renewal'
type Tab = 'mapping-pool' | 'visit-pool' | 'exceptional' | 'reband-immediate' | 'reband-renewal'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function parseProviders(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [raw] }
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000)
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return
  const headers = Object.keys(data[0])
  const rows = data.map(r => headers.map(h => JSON.stringify(r[h] ?? '')).join(','))
  const csv = [headers.join(','), ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── UI atoms ──────────────────────────────────────────────────────────────────
function BandBadge({ band }: { band: string | null }) {
  if (!band) return <span className="text-slate-400 text-xs">—</span>
  const colors: Record<string, string> = {
    A: 'bg-rose-100 text-rose-700 border-rose-200',
    B: 'bg-amber-100 text-amber-700 border-amber-200',
    C: 'bg-sky-100 text-sky-700 border-sky-200',
    D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  const key = band.trim().toUpperCase().replace(/^BAND\s?/, '')
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${colors[key] ?? 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      Band {key}
    </span>
  )
}

function AllowedBands({ bands }: { bands: string | null }) {
  if (!bands) return <span className="text-slate-400 text-xs">—</span>
  return (
    <div className="flex gap-1 flex-wrap">
      {bands.split(',').map(b => <BandBadge key={b} band={b.trim()} />)}
    </div>
  )
}

function CountdownBadge({ dateStr }: { dateStr: string | null }) {
  const days = daysUntil(dateStr)
  if (days === null) return <span className="text-slate-400 text-xs">—</span>
  if (days < 0) return (
    <span className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full border bg-slate-100 text-slate-500 border-slate-200">
      Expired
    </span>
  )
  const cls = days <= 30
    ? 'bg-rose-100 text-rose-700 border-rose-200'
    : days <= 90
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full border ${cls}`}>
      {days}d left
    </span>
  )
}

// ── Decision tab table ────────────────────────────────────────────────────────
function DecisionTabTable({
  rows, title, filename, showCountdown, isAdminUser,
}: {
  rows: Decision[]
  title: string
  filename: string
  showCountdown: boolean
  isAdminUser: boolean
}) {
  const [search, setSearch] = useState('')
  const filtered = rows.filter(r =>
    !search ||
    (r.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.enrollee_id.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search by name or enrollee ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {isAdminUser && (
          <button
            onClick={() => downloadCSV(rows as unknown as Record<string, unknown>[], filename)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
          >
            ↓ Download CSV
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">✓</p>
          <p>{rows.length === 0 ? `No ${title} decisions yet.` : 'No results match your search.'}</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'Enrollee', 'Plan', 'Price (Ind/Fam)', 'Allowed Bands',
                    'Provider / Visits', 'Provider Band',
                    'Decided By', 'Decided At',
                    ...(showCountdown ? ['Contract End', 'Countdown'] : []),
                  ].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(r => {
                  const providers = parseProviders(r.higher_band_providers)
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">{r.full_name || '—'}</div>
                        <div className="text-xs text-slate-400 mt-0.5 font-mono">{r.enrollee_id}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700">{r.plan_name || '—'}</td>
                      <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                        <div>{fmt(r.individual_price)}</div>
                        <div className="text-xs text-slate-400">{fmt(r.family_price)}</div>
                      </td>
                      <td className="px-4 py-3"><AllowedBands bands={r.allowed_bands} /></td>
                      <td className="px-4 py-3 max-w-[200px]">
                        {r.flag_type === 'mapping' ? (
                          <div className="text-slate-700 text-xs line-clamp-2">{r.mapped_provider_name || '—'}</div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {providers.slice(0, 2).map(p => (
                              <span key={p} className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5 line-clamp-1">{p}</span>
                            ))}
                            {providers.length > 2 && <span className="text-xs text-slate-400">+{providers.length - 2} more</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.flag_type === 'mapping'
                          ? <BandBadge band={r.mapped_provider_band} />
                          : <span className="text-xs text-slate-400">visit</span>
                        }
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-slate-700 text-xs">{r.decided_by_name || '—'}</div>
                        <div className="text-xs text-slate-400">{r.decided_by_dept || ''}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                        {r.decided_at ? new Date(r.decided_at).toLocaleDateString('en-NG') : '—'}
                      </td>
                      {showCountdown && (
                        <>
                          <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                            {r.contract_end_date ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            <CountdownBadge dateStr={r.contract_end_date} />
                          </td>
                        </>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {rows.length} records
          </div>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProviderBandMappingPage() {
  const { user }     = useAuth()
  const adminUser    = isAdmin(user)
  const clientMgtUser = !adminUser && (user?.department?.toLowerCase().includes('client') ?? false)
  const canDecide    = adminUser || clientMgtUser

  const [tab,         setTab]         = useState<Tab>('mapping-pool')
  const [mappingRows, setMappingRows] = useState<MappingFlag[]>([])
  const [visitRows,   setVisitRows]   = useState<VisitFlag[]>([])
  const [decisions,   setDecisions]   = useState<Decision[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [scannedAt,   setScannedAt]   = useState<string | null>(null)

  // Pool filters
  const [mSearch,   setMSearch]   = useState('')
  const [mProvider, setMProvider] = useState('')
  const [vSearch,   setVSearch]   = useState('')
  const [vProvider, setVProvider] = useState('')

  // Inline action
  const [actionRow, setActionRow] = useState<string | null>(null)
  const [deciding,  setDeciding]  = useState(false)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const [mRes, vRes, dRes] = await Promise.all([
      supabase.from('enrollee_provider_mapping_flags').select('*').order('scanned_at', { ascending: false }),
      supabase.from('enrollee_provider_visit_flags').select('*').order('visit_count_higher_band', { ascending: false }),
      supabase.from('enrollee_band_decisions').select('*').order('decided_at', { ascending: false }),
    ])
    if (mRes.error || vRes.error || dRes.error) {
      setError(mRes.error?.message ?? vRes.error?.message ?? dRes.error?.message ?? 'Failed to load')
      setLoading(false)
      return
    }
    setMappingRows(mRes.data ?? [])
    setVisitRows(vRes.data ?? [])
    setDecisions(dRes.data ?? [])
    if ((mRes.data ?? []).length) setScannedAt(mRes.data![0].scanned_at)
    setLoading(false)
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const decidedIds      = new Set(decisions.map(d => d.enrollee_id))
  const mappingPool     = mappingRows.filter(r => !decidedIds.has(r.enrollee_id))
  const visitPool       = visitRows.filter(r => !decidedIds.has(r.enrollee_id))
  const exceptional     = decisions.filter(d => d.decision === 'exceptional_approved')
  const rebandImmediate = decisions.filter(d => d.decision === 'reband_immediately')
  const rebandRenewal   = decisions.filter(d => d.decision === 'reband_at_renewal')

  const filteredMapping = mappingPool.filter(r => {
    const s = mSearch.toLowerCase()
    const p = mProvider.toLowerCase()
    return (!s || (r.full_name ?? '').toLowerCase().includes(s) || r.enrollee_id.toLowerCase().includes(s))
        && (!p || (r.mapped_provider_name ?? '').toLowerCase().includes(p))
  })

  const filteredVisit = visitPool.filter(r => {
    const s = vSearch.toLowerCase()
    const p = vProvider.toLowerCase()
    const provs = parseProviders(r.higher_band_providers)
    return (!s || (r.full_name ?? '').toLowerCase().includes(s) || r.enrollee_id.toLowerCase().includes(s))
        && (!p || provs.some(pv => pv.toLowerCase().includes(p)))
  })

  // ── Decision action ───────────────────────────────────────────────────────────
  async function makeDecision(
    row: MappingFlag | VisitFlag,
    flagType: 'mapping' | 'visit',
    decision: DecisionType,
  ) {
    if (deciding) return
    setDeciding(true)
    const rec = {
      enrollee_id:          row.enrollee_id,
      full_name:            row.full_name,
      plan_name:            row.plan_name,
      individual_price:     row.individual_price,
      family_price:         row.family_price,
      allowed_bands:        row.allowed_bands,
      mapped_provider_name: flagType === 'mapping' ? (row as MappingFlag).mapped_provider_name : null,
      mapped_provider_band: flagType === 'mapping' ? (row as MappingFlag).mapped_provider_band : null,
      higher_band_providers:flagType === 'visit'   ? (row as VisitFlag).higher_band_providers  : null,
      flag_type:            flagType,
      decision,
      decided_by_name:      user ? `${user.first_name} ${user.last_name}` : null,
      decided_by_dept:      user?.department ?? null,
      decided_at:           new Date().toISOString(),
      contract_end_date:    row.contract_end_date ?? null,
      notes:                null,
    }
    const { error: err } = await supabase
      .from('enrollee_band_decisions')
      .upsert(rec, { onConflict: 'enrollee_id' })
    if (err) {
      alert('Failed to save decision: ' + err.message)
    } else {
      setDecisions(prev => [
        rec as unknown as Decision,
        ...prev.filter(d => d.enrollee_id !== row.enrollee_id),
      ])
    }
    setActionRow(null)
    setDeciding(false)
  }

  // ── Loading / error ───────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        Loading band mapping data…
      </div>
    </div>
  )
  if (error) return (
    <div className="p-8 text-center text-rose-600">
      <p className="font-semibold">Failed to load data</p>
      <p className="text-sm mt-1 text-slate-500">{error}</p>
    </div>
  )

  // ── Tab config ────────────────────────────────────────────────────────────────
  const TABS = [
    { id: 'mapping-pool'    as Tab, label: 'Mapping Pool',         count: mappingPool.length,     border: 'border-rose-300',   bg: 'bg-rose-50',   text: 'text-rose-700'   },
    { id: 'visit-pool'      as Tab, label: 'Visit Pool',           count: visitPool.length,       border: 'border-amber-300',  bg: 'bg-amber-50',  text: 'text-amber-700'  },
    { id: 'exceptional'     as Tab, label: 'Exceptional Approved', count: exceptional.length,     border: 'border-sky-300',    bg: 'bg-sky-50',    text: 'text-sky-700'    },
    { id: 'reband-immediate'as Tab, label: 'Reband Immediately',   count: rebandImmediate.length, border: 'border-red-300',    bg: 'bg-red-50',    text: 'text-red-700'    },
    { id: 'reband-renewal'  as Tab, label: 'Reband at Renewal',    count: rebandRenewal.length,   border: 'border-orange-300', bg: 'bg-orange-50', text: 'text-orange-700' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enrollee–Provider Band Mapping</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Track and action enrollees mapped to or visiting providers above their plan tier.
          </p>
        </div>
        <div className="text-xs text-slate-400 text-right">
          Refreshes daily at 12:00 AM WAT
          {scannedAt && (
            <><br />Last scan: <span className="font-medium text-slate-600">{new Date(scannedAt).toLocaleString('en-NG')}</span></>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setActionRow(null) }}
            className={`rounded-xl border p-4 text-left transition-all ${t.border} ${t.bg}
              ${tab === t.id ? 'ring-2 ring-offset-1 ring-indigo-400' : 'hover:opacity-80'}`}
          >
            <div className={`text-2xl font-bold ${t.text}`}>{t.count}</div>
            <div className={`text-xs font-semibold mt-0.5 ${t.text}`}>{t.label}</div>
          </button>
        ))}
      </div>

      {/* Band legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-3">
        <span className="font-semibold text-slate-600">Band tiers:</span>
        {[
          { band: 'D', label: 'Lowest  ₦0–81,779 ind',     color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
          { band: 'C', label: '₦81,800–117,244 ind',        color: 'bg-sky-100 text-sky-700 border-sky-200' },
          { band: 'B', label: '₦117,245–344,999 ind',       color: 'bg-amber-100 text-amber-700 border-amber-200' },
          { band: 'A', label: 'Highest  ₦345,000+ ind',     color: 'bg-rose-100 text-rose-700 border-rose-200' },
        ].map(({ band, label, color }) => (
          <span key={band} className="flex items-center gap-1.5">
            <span className={`inline-block font-bold px-2 py-0.5 rounded-full border text-xs ${color}`}>Band {band}</span>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setActionRow(null) }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-2
              ${tab === t.id ? 'border-indigo-500 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
              ${tab === t.id ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── MAPPING POOL ─────────────────────────────────────────────────────── */}
      {tab === 'mapping-pool' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="text" placeholder="Search by name or enrollee ID…"
              value={mSearch} onChange={e => setMSearch(e.target.value)}
              className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="text" placeholder="Filter by mapped provider…"
              value={mProvider} onChange={e => setMProvider(e.target.value)}
              className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {filteredMapping.length === 0 ? (
            <div className="text-center py-16 text-slate-400"><p className="text-4xl mb-3">✓</p><p>No inappropriate provider mappings in pool.</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Enrollee', 'Plan', 'Price (Ind/Fam)', 'Allowed Bands', 'Mapped Provider', 'Mapped Band', 'Reason', ...(canDecide ? ['Action'] : [])].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMapping.map(r => (
                      <tr key={r.id} className="hover:bg-rose-50/30 transition-colors">
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-800">{r.full_name || '—'}</div>
                          <div className="text-xs text-slate-400 mt-0.5 font-mono">{r.enrollee_id}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-slate-700">{r.plan_name || '—'}</div>
                          {r.plan_code && <div className="text-xs text-slate-400">{r.plan_code}</div>}
                        </td>
                        <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                          <div>{fmt(r.individual_price)}</div>
                          <div className="text-xs text-slate-400">{fmt(r.family_price)}</div>
                        </td>
                        <td className="px-4 py-3"><AllowedBands bands={r.allowed_bands} /></td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <div className="text-slate-700 line-clamp-2">{r.mapped_provider_name || '—'}</div>
                          {r.mapped_provider_id && <div className="text-xs text-slate-400">ID: {r.mapped_provider_id}</div>}
                        </td>
                        <td className="px-4 py-3"><BandBadge band={r.mapped_provider_band} /></td>
                        <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px]">{r.flag_reason || '—'}</td>
                        {canDecide && (
                          <td className="px-4 py-3">
                            {actionRow !== r.enrollee_id ? (
                              <button
                                onClick={() => setActionRow(r.enrollee_id)}
                                className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors whitespace-nowrap"
                              >
                                Decide ▾
                              </button>
                            ) : (
                              <div className="flex flex-col gap-1.5 min-w-[190px]">
                                {(adminUser || clientMgtUser) && (
                                  <button onClick={() => makeDecision(r, 'mapping', 'exceptional_approved')} disabled={deciding}
                                    className="text-xs font-medium px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-200 transition-colors text-left">
                                    ✓ Exceptional Approved
                                  </button>
                                )}
                                {adminUser && (
                                  <>
                                    <button onClick={() => makeDecision(r, 'mapping', 'reband_immediately')} disabled={deciding}
                                      className="text-xs font-medium px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 transition-colors text-left">
                                      ⚡ Reband Immediately
                                    </button>
                                    <button onClick={() => makeDecision(r, 'mapping', 'reband_at_renewal')} disabled={deciding}
                                      className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors text-left">
                                      ⏱ Reband at Renewal
                                    </button>
                                  </>
                                )}
                                <button onClick={() => setActionRow(null)}
                                  className="text-xs text-slate-400 hover:text-slate-600 text-left px-1 py-0.5">
                                  Cancel
                                </button>
                              </div>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
                Showing {filteredMapping.length} of {mappingPool.length} in pool
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISIT POOL ───────────────────────────────────────────────────────── */}
      {tab === 'visit-pool' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <input type="text" placeholder="Search by name or enrollee ID…"
              value={vSearch} onChange={e => setVSearch(e.target.value)}
              className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="text" placeholder="Filter by provider visited…"
              value={vProvider} onChange={e => setVProvider(e.target.value)}
              className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
          </div>

          {filteredVisit.length === 0 ? (
            <div className="text-center py-16 text-slate-400"><p className="text-4xl mb-3">✓</p><p>No inappropriate provider visits in pool.</p></div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Enrollee', 'Plan', 'Price (Ind/Fam)', 'Allowed Bands', 'Visits', 'Last Visit', 'Providers Used', ...(canDecide ? ['Action'] : [])].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredVisit.map(r => {
                      const providers = parseProviders(r.higher_band_providers)
                      return (
                        <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">{r.full_name || '—'}</div>
                            <div className="text-xs text-slate-400 mt-0.5 font-mono">{r.enrollee_id}</div>
                          </td>
                          <td className="px-4 py-3 text-slate-700">{r.plan_name || '—'}</td>
                          <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                            <div>{fmt(r.individual_price)}</div>
                            <div className="text-xs text-slate-400">{fmt(r.family_price)}</div>
                          </td>
                          <td className="px-4 py-3"><AllowedBands bands={r.allowed_bands} /></td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-sm">
                              {r.visit_count_higher_band}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{r.last_visit_date || '—'}</td>
                          <td className="px-4 py-3 max-w-[220px]">
                            <div className="flex flex-col gap-1">
                              {providers.slice(0, 2).map(p => (
                                <span key={p} className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5 line-clamp-1">{p}</span>
                              ))}
                              {providers.length > 2 && <span className="text-xs text-slate-400">+{providers.length - 2} more</span>}
                            </div>
                          </td>
                          {canDecide && (
                            <td className="px-4 py-3">
                              {actionRow !== r.enrollee_id ? (
                                <button
                                  onClick={() => setActionRow(r.enrollee_id)}
                                  className="text-xs font-medium px-3 py-1.5 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 border border-indigo-200 transition-colors whitespace-nowrap"
                                >
                                  Decide ▾
                                </button>
                              ) : (
                                <div className="flex flex-col gap-1.5 min-w-[190px]">
                                  {(adminUser || clientMgtUser) && (
                                    <button onClick={() => makeDecision(r, 'visit', 'exceptional_approved')} disabled={deciding}
                                      className="text-xs font-medium px-2 py-1 rounded bg-sky-100 text-sky-700 hover:bg-sky-200 border border-sky-200 transition-colors text-left">
                                      ✓ Exceptional Approved
                                    </button>
                                  )}
                                  {adminUser && (
                                    <>
                                      <button onClick={() => makeDecision(r, 'visit', 'reband_immediately')} disabled={deciding}
                                        className="text-xs font-medium px-2 py-1 rounded bg-rose-100 text-rose-700 hover:bg-rose-200 border border-rose-200 transition-colors text-left">
                                        ⚡ Reband Immediately
                                      </button>
                                      <button onClick={() => makeDecision(r, 'visit', 'reband_at_renewal')} disabled={deciding}
                                        className="text-xs font-medium px-2 py-1 rounded bg-amber-100 text-amber-700 hover:bg-amber-200 border border-amber-200 transition-colors text-left">
                                        ⏱ Reband at Renewal
                                      </button>
                                    </>
                                  )}
                                  <button onClick={() => setActionRow(null)}
                                    className="text-xs text-slate-400 hover:text-slate-600 text-left px-1 py-0.5">
                                    Cancel
                                  </button>
                                </div>
                              )}
                            </td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
                Showing {filteredVisit.length} of {visitPool.length} in pool
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── DECISION TABS ────────────────────────────────────────────────────── */}
      {tab === 'exceptional' && (
        <DecisionTabTable rows={exceptional} title="Exceptional Approved"
          filename="exceptional_approved.csv" showCountdown={false} isAdminUser={adminUser} />
      )}
      {tab === 'reband-immediate' && (
        <DecisionTabTable rows={rebandImmediate} title="Reband Immediately"
          filename="reband_immediately.csv" showCountdown={false} isAdminUser={adminUser} />
      )}
      {tab === 'reband-renewal' && (
        <DecisionTabTable rows={rebandRenewal} title="Reband at Renewal"
          filename="reband_at_renewal.csv" showCountdown={true} isAdminUser={adminUser} />
      )}
    </div>
  )
}
