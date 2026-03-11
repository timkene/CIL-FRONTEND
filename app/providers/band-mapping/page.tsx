'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

// ── Types ─────────────────────────────────────────────────────────────────────
interface MappingFlag {
  id:                   number
  enrollee_id:          string
  full_name:            string | null
  plan_name:            string | null
  plan_code:            string | null
  individual_price:     number | null
  family_price:         number | null
  allowed_bands:        string | null
  mapped_provider_id:   string | null
  mapped_provider_name: string | null
  mapped_provider_band: string | null
  flag_reason:          string | null
  scanned_at:           string
}

interface VisitFlag {
  id:                      number
  enrollee_id:             string
  full_name:               string | null
  plan_name:               string | null
  individual_price:        number | null
  family_price:            number | null
  allowed_bands:           string | null
  visit_count_higher_band: number
  last_visit_date:         string | null
  higher_band_providers:   string | null   // JSON array
  scanned_at:              string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function BandBadge({ band }: { band: string | null }) {
  if (!band) return <span className="text-slate-400 text-xs">—</span>
  const colors: Record<string, string> = {
    A: 'bg-rose-100 text-rose-700 border-rose-200',
    B: 'bg-amber-100 text-amber-700 border-amber-200',
    C: 'bg-sky-100 text-sky-700 border-sky-200',
    D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  }
  const key = band.trim().toUpperCase().replace(/^BAND\s?/, '')
  const cls = colors[key] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full border ${cls}`}>
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

function parseProviders(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [raw] }
}

// ── Subcomponents ─────────────────────────────────────────────────────────────
function EmptyState({ message }: { message: string }) {
  return (
    <div className="text-center py-16 text-slate-400">
      <p className="text-4xl mb-3">✓</p>
      <p className="font-medium">{message}</p>
    </div>
  )
}

function MappingTable({ rows, search }: { rows: MappingFlag[]; search: string }) {
  const filtered = rows.filter(r =>
    !search ||
    (r.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.enrollee_id.toLowerCase().includes(search.toLowerCase()) ||
    (r.mapped_provider_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (filtered.length === 0) return <EmptyState message="No inappropriate provider mappings found." />

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Enrollee', 'Plan', 'Price (Ind / Fam)', 'Allowed Bands', 'Mapped Provider', 'Mapped Band', 'Reason'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => (
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
                <td className="px-4 py-3">
                  <AllowedBands bands={r.allowed_bands} />
                </td>
                <td className="px-4 py-3 max-w-[200px]">
                  <div className="text-slate-700 line-clamp-2">{r.mapped_provider_name || '—'}</div>
                  {r.mapped_provider_id && (
                    <div className="text-xs text-slate-400">ID: {r.mapped_provider_id}</div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <BandBadge band={r.mapped_provider_band} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 max-w-[220px]">
                  {r.flag_reason || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
        Showing {filtered.length} of {rows.length} flagged enrollees
      </div>
    </div>
  )
}

function VisitTable({ rows, search }: { rows: VisitFlag[]; search: string }) {
  const filtered = rows.filter(r =>
    !search ||
    (r.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    r.enrollee_id.toLowerCase().includes(search.toLowerCase())
  )

  if (filtered.length === 0) return <EmptyState message="No inappropriate provider visits found." />

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Enrollee', 'Plan', 'Price (Ind / Fam)', 'Allowed Bands', 'Higher-Band Visits', 'Last Visit', 'Providers Used'].map(h => (
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
                  <td className="px-4 py-3">
                    <AllowedBands bands={r.allowed_bands} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-rose-100 text-rose-700 font-bold text-sm">
                      {r.visit_count_higher_band}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap text-xs">
                    {r.last_visit_date ?? '—'}
                  </td>
                  <td className="px-4 py-3 max-w-[240px]">
                    <div className="flex flex-col gap-1">
                      {providers.slice(0, 3).map(p => (
                        <span key={p} className="text-xs text-slate-600 bg-slate-100 rounded px-2 py-0.5 line-clamp-1">
                          {p}
                        </span>
                      ))}
                      {providers.length > 3 && (
                        <span className="text-xs text-slate-400">+{providers.length - 3} more</span>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
        Showing {filtered.length} of {rows.length} flagged enrollees
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
type Tab = 'mapping' | 'visits'

export default function ProviderBandMappingPage() {
  const [tab,          setTab]          = useState<Tab>('mapping')
  const [mappingRows,  setMappingRows]  = useState<MappingFlag[]>([])
  const [visitRows,    setVisitRows]    = useState<VisitFlag[]>([])
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState<string | null>(null)
  const [search,       setSearch]       = useState('')
  const [scannedAt,    setScannedAt]    = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      const [{ data: mData, error: mErr }, { data: vData, error: vErr }] = await Promise.all([
        supabase
          .from('enrollee_provider_mapping_flags')
          .select('*')
          .order('scanned_at', { ascending: false }),
        supabase
          .from('enrollee_provider_visit_flags')
          .select('*')
          .order('visit_count_higher_band', { ascending: false }),
      ])

      if (mErr || vErr) {
        setError(mErr?.message ?? vErr?.message ?? 'Failed to load data')
        setLoading(false)
        return
      }

      setMappingRows(mData ?? [])
      setVisitRows(vData ?? [])
      if ((mData ?? []).length > 0) setScannedAt(mData![0].scanned_at)
      else if ((vData ?? []).length > 0) setScannedAt(vData![0].scanned_at)
      setLoading(false)
    }
    load()
  }, [])

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

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enrollee–Provider Band Mapping</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Flags enrollees mapped to or visiting providers above their plan's allowed band tier.
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
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setTab('mapping')}
          className={`rounded-xl border p-5 text-left transition-all
            ${tab === 'mapping'
              ? 'border-rose-300 bg-rose-50 ring-2 ring-rose-300 ring-offset-1'
              : 'border-slate-200 bg-white hover:border-rose-200'}`}
        >
          <div className="text-3xl font-bold text-rose-600">{mappingRows.length}</div>
          <div className="text-sm font-semibold text-rose-700 mt-1">Inappropriate Mappings</div>
          <div className="text-xs text-slate-500 mt-0.5">Enrollees assigned to a provider above their allowed band</div>
        </button>
        <button
          onClick={() => setTab('visits')}
          className={`rounded-xl border p-5 text-left transition-all
            ${tab === 'visits'
              ? 'border-amber-300 bg-amber-50 ring-2 ring-amber-300 ring-offset-1'
              : 'border-slate-200 bg-white hover:border-amber-200'}`}
        >
          <div className="text-3xl font-bold text-amber-600">{visitRows.length}</div>
          <div className="text-sm font-semibold text-amber-700 mt-1">Inappropriate Visits</div>
          <div className="text-xs text-slate-500 mt-0.5">Enrollees who visited a higher-band provider &gt;2× in 3 months</div>
        </button>
      </div>

      {/* Band legend */}
      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 bg-white border border-slate-200 rounded-lg px-4 py-3">
        <span className="font-semibold text-slate-600">Band tiers:</span>
        {[
          { band: 'D', label: 'Lowest  ₦0–81,779 ind', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
          { band: 'C', label: '₦81,800–117,244 ind',   color: 'bg-sky-100 text-sky-700 border-sky-200' },
          { band: 'B', label: '₦117,245–344,999 ind',  color: 'bg-amber-100 text-amber-700 border-amber-200' },
          { band: 'A', label: 'Highest  ₦345,000+ ind', color: 'bg-rose-100 text-rose-700 border-rose-200' },
        ].map(({ band, label, color }) => (
          <span key={band} className="flex items-center gap-1.5">
            <span className={`inline-block font-bold px-2 py-0.5 rounded-full border text-xs ${color}`}>
              Band {band}
            </span>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-200">
        {([
          { id: 'mapping', label: 'Inappropriate Provider Mapping', count: mappingRows.length, accent: 'rose' },
          { id: 'visits',  label: 'Inappropriate Provider Visit',   count: visitRows.length,   accent: 'amber' },
        ] as const).map(t => (
          <button
            key={t.id}
            onClick={() => { setTab(t.id); setSearch('') }}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px flex items-center gap-2
              ${tab === t.id
                ? t.accent === 'rose'
                  ? 'border-rose-500 text-rose-600'
                  : 'border-amber-500 text-amber-600'
                : 'border-transparent text-slate-500 hover:text-slate-700'}`}
          >
            {t.label}
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full
              ${tab === t.id
                ? t.accent === 'rose' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'
                : 'bg-slate-100 text-slate-500'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder={tab === 'mapping' ? 'Search by name, enrollee ID or provider…' : 'Search by name or enrollee ID…'}
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full max-w-md border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
      />

      {/* Table */}
      {tab === 'mapping'
        ? <MappingTable rows={mappingRows} search={search} />
        : <VisitTable   rows={visitRows}   search={search} />
      }
    </div>
  )
}
