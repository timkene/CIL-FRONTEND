'use client'
import { useEffect, useState } from 'react'
import { supabase, MLRSummary } from '@/lib/supabase'
import DebitBinChart from '@/components/claims/DebitBinChart'

const DEBIT_BINS = [
  { label: '₦0 – ₦5M',       min: 0,           max: 5_000_000 },
  { label: '₦5M – ₦15M',     min: 5_000_001,   max: 15_000_000 },
  { label: '₦15M – ₦30M',    min: 15_000_001,  max: 30_000_000 },
  { label: '₦30M – ₦50M',    min: 30_000_001,  max: 50_000_000 },
  { label: '₦50M – ₦100M',   min: 50_000_001,  max: 100_000_000 },
  { label: '> ₦100M',         min: 100_000_001, max: Infinity },
]

const CONTRACT_BINS = [
  { label: '≤ 3 Months Left',  minMo: 0, maxMo: 3 },
  { label: '4 – 6 Months Left', minMo: 4, maxMo: 6 },
  { label: '7 – 9 Months Left', minMo: 7, maxMo: 9 },
]

function fmt(n: number) {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)         return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

export default function PremiumAnalysisPage() {
  const [data, setData]       = useState<MLRSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      const { data: rows, error: err } = await supabase
        .from('mlr_summary')
        .select('*')
        .eq('had_error', false)
        .gt('total_debit_amount', 0)
      if (err) { setError(err.message); setLoading(false); return }
      setData(rows ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="material-symbols-outlined text-4xl text-[#137fec]" style={{ animation: 'spin 1s linear infinite' }}>
          progress_activity
        </span>
        <p className="text-sm font-medium">Loading Premium Analysis...</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 max-w-md text-center">
        <span className="material-symbols-outlined text-3xl mb-2">error</span>
        <p className="font-bold">Failed to load data</p>
        <p className="text-sm mt-1">{error}</p>
      </div>
    </div>
  )

  // ── summary stats ──────────────────────────────────────────────────────────
  const totalDebit    = data.reduce((s, d) => s + d.total_debit_amount, 0)
  const totalMedical  = data.reduce((s, d) => s + d.total_actual_medical_cost, 0)
  const avgActualMlr  = data.length ? data.reduce((s, d) => s + d.actual_mlr, 0) / data.length : 0
  const above75Actual = data.filter(d => d.actual_mlr > 0.75).length

  const summaryCards = [
    {
      label:     'Total Portfolio Debit',
      value:     fmt(totalDebit),
      sub:       `across ${data.length} active clients`,
      icon:      'account_balance_wallet',
      iconBg:    'bg-[#137fec]/10',
      iconColor: 'text-[#137fec]',
    },
    {
      label:     'Total Medical Cost',
      value:     fmt(totalMedical),
      sub:       'Actual claims + unclaimed PA',
      icon:      'payments',
      iconBg:    'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
    {
      label:     'Portfolio Average MLR',
      value:     `${(avgActualMlr * 100).toFixed(1)}%`,
      sub:       'Weighted across all premium bands',
      icon:      'insights',
      iconBg:    avgActualMlr > 0.75 ? 'bg-rose-500/10' : 'bg-amber-500/10',
      iconColor: avgActualMlr > 0.75 ? 'text-rose-500' : 'text-amber-500',
      valueColor: avgActualMlr > 0.75 ? 'text-rose-500' : avgActualMlr > 0.70 ? 'text-amber-500' : 'text-emerald-600',
    },
    {
      label:     'Clients Above 75% Actual MLR',
      value:     String(above75Actual),
      sub:       `${((above75Actual / data.length) * 100).toFixed(0)}% of active portfolio`,
      icon:      'warning',
      iconBg:    'bg-amber-500/10',
      iconColor: 'text-amber-500',
    },
  ]

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Premium Analysis</h2>
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          <span className="material-symbols-outlined text-sm">schedule</span>
          Last updated: {data[0]?.computed_at
            ? new Date(data[0].computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
            : '—'}
        </div>
      </header>

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">

        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {summaryCards.map(c => (
            <div key={c.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex justify-between items-start">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{c.label}</p>
                <span className={`material-symbols-outlined ${c.iconColor} ${c.iconBg} p-1.5 rounded-lg text-xl`}>
                  {c.icon}
                </span>
              </div>
              <div className="mt-4">
                <h3 className={`text-3xl font-extrabold ${(c as { valueColor?: string }).valueColor ?? ''}`}>{c.value}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-2">{c.sub}</p>
            </div>
          ))}
        </div>

        {/* Section heading */}
        <div>
          <h3 className="text-lg font-bold">MLR Distribution by Premium Band</h3>
          <p className="text-sm text-slate-500 mt-1">
            Each chart shows how many clients in that debit range fall into each MLR category —
            <span className="text-[#137fec] font-semibold"> blue = Actual MLR</span>,
            <span className="text-slate-400 font-semibold"> grey = Claims-Paid MLR</span>
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 text-xs font-medium text-slate-600 -mt-4">
          {[
            { color: '#22c55e', label: '< 50% — Profitable' },
            { color: '#f59e0b', label: '50–75% — Watch Zone' },
            { color: '#ef4444', label: '> 75% — Loss Territory' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>

        {/* 6 charts — 3 per row on xl screens */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {DEBIT_BINS.map(bin => {
            const clients = data.filter(
              d => d.total_debit_amount >= bin.min && d.total_debit_amount <= bin.max
            )
            return (
              <DebitBinChart
                key={bin.label}
                label={bin.label}
                clients={clients}
              />
            )
          })}
        </div>

        {/* ── MLR Distribution by Contract Left ───────────────────────── */}
        <div className="pt-4 border-t border-slate-100">
          <h3 className="text-lg font-bold">MLR Distribution by Contract Left</h3>
          <p className="text-sm text-slate-500 mt-1">
            Clients grouped by months remaining on their contract —
            <span className="text-[#137fec] font-semibold"> blue = Actual MLR</span>,
            <span className="text-slate-400 font-semibold"> grey = Claims-Paid MLR</span>
          </p>
        </div>

        <div className="flex items-center gap-6 text-xs font-medium text-slate-600 -mt-4">
          {[
            { color: '#22c55e', label: '< 50% — Profitable' },
            { color: '#f59e0b', label: '50–75% — Watch Zone' },
            { color: '#ef4444', label: '> 75% — Loss Territory' },
          ].map(l => (
            <span key={l.label} className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {CONTRACT_BINS.map(bin => {
            const clients = data.filter(d => {
              const remaining = d.contract_months - d.elapsed_months
              return remaining >= bin.minMo && remaining <= bin.maxMo
            })
            return (
              <DebitBinChart
                key={bin.label}
                label={bin.label}
                clients={clients}
              />
            )
          })}
        </div>

      </div>
    </>
  )
}
