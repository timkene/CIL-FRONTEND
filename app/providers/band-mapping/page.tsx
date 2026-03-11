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
  scanned_at: string
}

type Tab = 'mapping-pool' | 'visit-pool'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number | null | undefined) {
  if (n == null) return '—'
  return `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function parseProviders(raw: string | null): string[] {
  if (!raw) return []
  try { return JSON.parse(raw) } catch { return [raw] }
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

function effectivePrice(row: { individual_price: number | null; family_price: number | null }): number | null {
  if (row.individual_price != null && row.individual_price > 0) return row.individual_price
  return row.family_price
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

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ProviderBandMappingPage() {
  const { user }  = useAuth()
  const adminUser = isAdmin(user)

  const [tab,         setTab]         = useState<Tab>('mapping-pool')
  const [mappingRows, setMappingRows] = useState<MappingFlag[]>([])
  const [visitRows,   setVisitRows]   = useState<VisitFlag[]>([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [scannedAt,   setScannedAt]   = useState<string | null>(null)

  // Mapping pool filters
  const [mSearch,   setMSearch]   = useState('')
  const [mProvider, setMProvider] = useState('')
  const [mMinPrice, setMMinPrice] = useState('')
  const [mMaxPrice, setMMaxPrice] = useState('')

  // Visit pool filters
  const [vSearch,   setVSearch]   = useState('')
  const [vProvider, setVProvider] = useState('')
  const [vMinPrice, setVMinPrice] = useState('')
  const [vMaxPrice, setVMaxPrice] = useState('')

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    setError(null)
    const [mRes, vRes] = await Promise.all([
      supabase.from('enrollee_provider_mapping_flags').select('*').order('scanned_at', { ascending: false }),
      supabase.from('enrollee_provider_visit_flags').select('*').order('visit_count_higher_band', { ascending: false }),
    ])
    if (mRes.error || vRes.error) {
      setError(mRes.error?.message ?? vRes.error?.message ?? 'Failed to load')
      setLoading(false)
      return
    }
    setMappingRows(mRes.data ?? [])
    setVisitRows(vRes.data ?? [])
    if ((mRes.data ?? []).length) setScannedAt(mRes.data![0].scanned_at)
    setLoading(false)
  }

  // ── Filtering helpers ────────────────────────────────────────────────────────
  function inPriceRange(row: { individual_price: number | null; family_price: number | null }, minStr: string, maxStr: string): boolean {
    const price = effectivePrice(row)
    if (price == null) return true
    if (minStr && price < Number(minStr)) return false
    if (maxStr && price > Number(maxStr)) return false
    return true
  }

  const filteredMapping = mappingRows.filter(r => {
    const s = mSearch.toLowerCase()
    const p = mProvider.toLowerCase()
    return (!s || (r.full_name ?? '').toLowerCase().includes(s) || r.enrollee_id.toLowerCase().includes(s))
        && (!p || (r.mapped_provider_name ?? '').toLowerCase().includes(p))
        && inPriceRange(r, mMinPrice, mMaxPrice)
  })

  const filteredVisit = visitRows.filter(r => {
    const s = vSearch.toLowerCase()
    const p = vProvider.toLowerCase()
    const provs = parseProviders(r.higher_band_providers)
    return (!s || (r.full_name ?? '').toLowerCase().includes(s) || r.enrollee_id.toLowerCase().includes(s))
        && (!p || provs.some(pv => pv.toLowerCase().includes(p)))
        && inPriceRange(r, vMinPrice, vMaxPrice)
  })

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

  const TABS = [
    { id: 'mapping-pool' as Tab, label: 'Mapping Pool', count: mappingRows.length, border: 'border-rose-300',  bg: 'bg-rose-50',  text: 'text-rose-700'  },
    { id: 'visit-pool'   as Tab, label: 'Visit Pool',   count: visitRows.length,   border: 'border-amber-300', bg: 'bg-amber-50', text: 'text-amber-700' },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Enrollee–Provider Band Mapping</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Enrollees mapped to or visiting providers above their plan tier.
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
      <div className="grid grid-cols-2 gap-3">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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
          { band: 'D', label: 'Lowest  ₦0–81,779 ind',      color: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
          { band: 'C', label: '₦81,800–117,244 ind',         color: 'bg-sky-100 text-sky-700 border-sky-200' },
          { band: 'B', label: '₦117,245–344,999 ind',        color: 'bg-amber-100 text-amber-700 border-amber-200' },
          { band: 'A', label: 'Highest  ₦345,000+ ind',      color: 'bg-rose-100 text-rose-700 border-rose-200' },
        ].map(({ band, label, color }) => (
          <span key={band} className="flex items-center gap-1.5">
            <span className={`inline-block font-bold px-2 py-0.5 rounded-full border text-xs ${color}`}>Band {band}</span>
            <span>{label}</span>
          </span>
        ))}
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
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
            <input type="number" placeholder="Min price (₦)"
              value={mMinPrice} onChange={e => setMMinPrice(e.target.value)}
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="number" placeholder="Max price (₦)"
              value={mMaxPrice} onChange={e => setMMaxPrice(e.target.value)}
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            {adminUser && (
              <button
                onClick={() => downloadCSV(filteredMapping as unknown as Record<string, unknown>[], 'mapping_flags.csv')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                ↓ Download CSV
              </button>
            )}
          </div>

          {filteredMapping.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">✓</p>
              <p>{mappingRows.length === 0 ? 'No inappropriate provider mappings found.' : 'No results match your filters.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Enrollee', 'Plan', 'Price (Ind / Fam)', 'Allowed Bands', 'Mapped Provider', 'Mapped Band', 'Reason'].map(h => (
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
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
                Showing {filteredMapping.length} of {mappingRows.length} records
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
            <input type="number" placeholder="Min price (₦)"
              value={vMinPrice} onChange={e => setVMinPrice(e.target.value)}
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            <input type="number" placeholder="Max price (₦)"
              value={vMaxPrice} onChange={e => setVMaxPrice(e.target.value)}
              className="w-36 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
            {adminUser && (
              <button
                onClick={() => downloadCSV(filteredVisit as unknown as Record<string, unknown>[], 'visit_flags.csv')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 text-white text-sm font-medium hover:bg-slate-700 transition-colors whitespace-nowrap"
              >
                ↓ Download CSV
              </button>
            )}
          </div>

          {filteredVisit.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <p className="text-4xl mb-3">✓</p>
              <p>{visitRows.length === 0 ? 'No inappropriate provider visits found.' : 'No results match your filters.'}</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      {['Enrollee', 'Plan', 'Price (Ind / Fam)', 'Allowed Bands', 'Visits', 'Last Visit', 'Providers Used'].map(h => (
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
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
                Showing {filteredVisit.length} of {visitRows.length} records
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
