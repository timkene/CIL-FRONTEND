'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface FraudScore {
  id:                 number
  scan_month:         string
  provider_id:        string
  provider_name:      string
  band:               string | null
  state:              string | null
  total_score:        number
  max_score:          number
  alert_status:       'ALERT' | 'WATCHLIST' | 'CLEAR'
  total_cost:         number | null
  unique_enrollees:   number | null
  cpe:                number | null
  cpv:                number | null
  vpe:                number | null
  drug_ratio_pct:     number | null
  dx_repeat_pct:      number | null
  short_interval_pct: number | null
  network_signal:     string | null
  cpe_ratio:          number | null
  groups_served:      number | null
  scanned_at:         string
}

type StatusFilter = 'ALL' | 'ALERT' | 'WATCHLIST' | 'CLEAR'

function fmt(n: number | null | undefined, decimals = 0) {
  if (n == null) return '—'
  return n.toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === 'ALERT'     ? 'bg-rose-100 text-rose-700 border border-rose-200' :
    status === 'WATCHLIST' ? 'bg-amber-100 text-amber-700 border border-amber-200' :
                             'bg-emerald-100 text-emerald-700 border border-emerald-200'
  const icon =
    status === 'ALERT'     ? '🚨' :
    status === 'WATCHLIST' ? '⚠️' : '✅'
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {icon} {status}
    </span>
  )
}

function NetworkBadge({ signal }: { signal: string | null }) {
  if (!signal || signal === 'INSUFFICIENT_DATA') return <span className="text-slate-400 text-xs">—</span>
  const cls = signal === 'GROUP_TARGETED'
    ? 'bg-rose-100 text-rose-700'
    : 'bg-emerald-100 text-emerald-700'
  return (
    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cls}`}>
      {signal === 'GROUP_TARGETED' ? '🎯 TARGETED' : '✓ CLEAN'}
    </span>
  )
}

function ScoreBar({ score, max }: { score: number; max: number }) {
  const pct = Math.round((score / max) * 100)
  const color = pct >= 50 ? 'bg-rose-500' : pct >= 30 ? 'bg-amber-400' : 'bg-emerald-500'
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 h-1.5 rounded-full bg-slate-200 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-600 tabular-nums">{score}/{max}</span>
    </div>
  )
}

export default function ProviderFraudPage() {
  const [providers,   setProviders]   = useState<FraudScore[]>([])
  const [scanMonth,   setScanMonth]   = useState<string | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [search,      setSearch]      = useState('')
  const [expanded,    setExpanded]    = useState<number | null>(null)

  useEffect(() => {
    // Get latest scan_month first
    supabase
      .from('provider_fraud_scores')
      .select('scan_month')
      .order('scan_month', { ascending: false })
      .limit(1)
      .then(({ data, error: err }) => {
        if (err || !data?.length) {
          setError(err?.message ?? 'No scan data found')
          setLoading(false)
          return
        }
        const month = data[0].scan_month
        setScanMonth(month)

        // Now fetch all providers for that month
        supabase
          .from('provider_fraud_scores')
          .select('*')
          .eq('scan_month', month)
          .order('total_score', { ascending: false })
          .then(({ data: rows, error: e2 }) => {
            if (e2) { setError(e2.message); setLoading(false); return }
            setProviders(rows ?? [])
            setLoading(false)
          })
      })
  }, [])

  const filtered = providers.filter(p => {
    const matchStatus = statusFilter === 'ALL' || p.alert_status === statusFilter
    const matchSearch = !search || p.provider_name.toLowerCase().includes(search.toLowerCase())
    return matchStatus && matchSearch
  })

  const alertCount     = providers.filter(p => p.alert_status === 'ALERT').length
  const watchlistCount = providers.filter(p => p.alert_status === 'WATCHLIST').length
  const clearCount     = providers.filter(p => p.alert_status === 'CLEAR').length

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-slate-500">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-indigo-500 rounded-full animate-spin mx-auto mb-3" />
        Loading fraud scan results…
      </div>
    </div>
  )

  if (error) return (
    <div className="p-8 text-center text-rose-600">
      <p className="font-semibold">Failed to load fraud data</p>
      <p className="text-sm mt-1 text-slate-500">{error}</p>
    </div>
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Provider Fraud Monitor</h1>
          {scanMonth && (
            <p className="text-sm text-slate-500 mt-0.5">
              Scan period: <span className="font-medium text-slate-700">{scanMonth}</span>
              &nbsp;·&nbsp;{providers.length} providers scored
            </p>
          )}
        </div>
        <div className="text-xs text-slate-400 text-right">
          Refreshes 1st of every month<br />
          Scores: 0–10 · Alert ≥ 5 · Watchlist ≥ 3
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'ALERT',     count: alertCount,     color: 'border-rose-200 bg-rose-50',    text: 'text-rose-700',    icon: '🚨' },
          { label: 'WATCHLIST', count: watchlistCount, color: 'border-amber-200 bg-amber-50',  text: 'text-amber-700',   icon: '⚠️' },
          { label: 'CLEAR',     count: clearCount,     color: 'border-emerald-200 bg-emerald-50', text: 'text-emerald-700', icon: '✅' },
        ].map(c => (
          <button
            key={c.label}
            onClick={() => setStatusFilter(prev => prev === c.label as StatusFilter ? 'ALL' : c.label as StatusFilter)}
            className={`rounded-xl border p-4 text-left transition-all ${c.color}
              ${statusFilter === c.label ? 'ring-2 ring-offset-1 ring-indigo-400' : 'hover:opacity-80'}`}
          >
            <div className={`text-3xl font-bold ${c.text}`}>{c.icon} {c.count}</div>
            <div className={`text-sm font-semibold mt-1 ${c.text}`}>{c.label}</div>
          </button>
        ))}
      </div>

      {/* Search + filter bar */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Search provider name…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-48 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
        {(['ALL', 'ALERT', 'WATCHLIST', 'CLEAR'] as StatusFilter[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-2 rounded-lg text-sm font-medium border transition-all
              ${statusFilter === s
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">No providers match your filter.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Provider', 'Band', 'State', 'Status', 'Score', 'CPE (₦)', 'CPV (₦)', 'Enrollees', 'Network Signal', 'CPE Ratio', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(p => (
                <>
                  <tr
                    key={p.id}
                    className={`hover:bg-slate-50 cursor-pointer transition-colors
                      ${p.alert_status === 'ALERT' ? 'bg-rose-50/40' : ''}`}
                    onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800 max-w-[220px]">
                      <span className="line-clamp-2">{p.provider_name}</span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.band ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{p.state ?? '—'}</td>
                    <td className="px-4 py-3"><StatusBadge status={p.alert_status} /></td>
                    <td className="px-4 py-3"><ScoreBar score={p.total_score} max={p.max_score} /></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">₦{fmt(p.cpe)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">₦{fmt(p.cpv)}</td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">{fmt(p.unique_enrollees)}</td>
                    <td className="px-4 py-3"><NetworkBadge signal={p.network_signal} /></td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {p.cpe_ratio != null ? `${p.cpe_ratio}×` : '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-400 text-xs">
                      {expanded === p.id ? '▲' : '▼'}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expanded === p.id && (
                    <tr key={`${p.id}-detail`} className="bg-slate-50/80">
                      <td colSpan={11} className="px-6 py-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          {[
                            { label: 'Total Cost',       value: `₦${fmt(p.total_cost)}` },
                            { label: 'VPE',              value: fmt(p.vpe, 2) },
                            { label: 'Drug Ratio',       value: `${fmt(p.drug_ratio_pct, 1)}%` },
                            { label: 'Dx Repeat Rate',   value: `${fmt(p.dx_repeat_pct, 1)}%` },
                            { label: 'Short Visit Interval', value: `${fmt(p.short_interval_pct, 1)}%` },
                            { label: 'Groups Served',    value: fmt(p.groups_served) },
                            { label: 'Network Signal',   value: p.network_signal ?? '—' },
                            { label: 'Scan Month',       value: p.scan_month },
                          ].map(item => (
                            <div key={item.label} className="bg-white rounded-lg px-3 py-2 border border-slate-200">
                              <div className="text-slate-400 mb-0.5">{item.label}</div>
                              <div className="font-semibold text-slate-800">{item.value}</div>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-3 border-t border-slate-100 text-xs text-slate-400">
            Showing {filtered.length} of {providers.length} providers
          </div>
        </div>
      )}
    </div>
  )
}
