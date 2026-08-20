'use client'
import { useState } from 'react'
import type { LiveMLRSummary } from '@/lib/types'

interface Props { data: LiveMLRSummary[] }

function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function StatusBadge({ mlr }: { mlr: number }) {
  if (mlr > 0.75) return <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 font-bold text-xs">{(mlr * 100).toFixed(1)}%</span>
  if (mlr > 0.70) return <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-bold text-xs">{(mlr * 100).toFixed(1)}%</span>
  return <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 font-bold text-xs">{(mlr * 100).toFixed(1)}%</span>
}

function UtilizationBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-slate-400 text-xs">—</span>
  if (pct > 75) return <span className="px-2 py-1 rounded bg-rose-500/10 text-rose-600 font-bold text-xs">{pct.toFixed(1)}%</span>
  if (pct >= 50) return <span className="px-2 py-1 rounded bg-amber-500/10 text-amber-600 font-bold text-xs">{pct.toFixed(1)}%</span>
  return <span className="px-2 py-1 rounded bg-emerald-500/10 text-emerald-600 font-bold text-xs">{pct.toFixed(1)}%</span>
}

function MarginBadge({ premiumPmpm, actualPmpm }: { premiumPmpm: number; actualPmpm: number }) {
  const margin = premiumPmpm - actualPmpm
  const sign   = margin >= 0 ? '+' : ''
  const color  = margin >= 0 ? 'text-emerald-600' : 'text-rose-600'
  return (
    <span className={`font-bold text-sm ${color} whitespace-nowrap`}>
      {sign}{fmt(margin)}
    </span>
  )
}

export default function ClientsTable({ data }: Props) {
  const [search, setSearch] = useState('')

  const rows = data
    .filter(d => d.total_debit_amount > 0)
    .filter(d => d.group_name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      return b.actual_mlr - a.actual_mlr
    })

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="p-4 md:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <div>
          <h4 className="text-lg font-bold">All Clients — MLR Ranking</h4>
          <p className="text-sm text-slate-500">
            Sorted by live MLR · {rows.length} clients
          </p>
        </div>
        <div className="relative w-full sm:w-56">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            className="pl-9 pr-4 py-2 bg-slate-100 border-none rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] w-full outline-none"
            placeholder="Search clients..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="bg-slate-50 text-slate-500 text-xs font-bold uppercase tracking-wider">
              <th className="px-6 py-3">#</th>
              <th className="px-6 py-3">Client</th>
              <th className="px-6 py-3">Period</th>
              <th className="px-6 py-3">Debit</th>
              <th className="px-6 py-3">Medical Cost</th>
              <th className="px-6 py-3 text-center">MLR</th>
              <th className="px-6 py-3">Medical Margin</th>
              <th className="px-6 py-3 text-center">Utilization</th>
              <th className="px-6 py-3">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r, i) => (
              <tr key={`${r.group_id}-${r.contract_id}`} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 text-slate-400 font-medium">{i + 1}</td>
                <td className="px-6 py-4 font-bold">{r.group_name.trim()}</td>
                <td className="px-6 py-4 text-slate-500 text-xs whitespace-nowrap">
                  {r.start_date} → {r.end_date}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">{fmt(r.total_debit_amount)}</td>
                <td className="px-6 py-4 whitespace-nowrap">{fmt(r.total_actual_medical_cost)}</td>
                <td className="px-6 py-4 text-center"><StatusBadge mlr={r.actual_mlr} /></td>
                <td className="px-6 py-4"><MarginBadge premiumPmpm={r.total_debit_amount} actualPmpm={r.total_actual_medical_cost} /></td>
                <td className="px-6 py-4 text-center"><UtilizationBadge pct={r.member_utilization_pct} /></td>
                <td className="px-6 py-4">
                  <span className={`text-xs font-bold px-2 py-1 rounded ${
                    r.actual_mlr > 0.75         ? 'bg-rose-100 text-rose-700' :
                    r.actual_mlr > 0.70         ? 'bg-amber-100 text-amber-700' :
                                                    'bg-emerald-100 text-emerald-700'
                  }`}>
                    {r.actual_mlr > 0.75 ? 'LOSS' : r.actual_mlr > 0.70 ? 'WARNING' : 'PROFITABLE'}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={9} className="px-6 py-12 text-center text-slate-400">No active clients found</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
