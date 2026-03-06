'use client'
import { MLRSummary } from '@/lib/supabase'

interface Props { data: MLRSummary[] }

function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

export default function SummaryCards({ data }: Props) {
  const withDebit = data.filter(d => d.total_debit_amount > 0)

  const above75   = withDebit.filter(d => d.actual_mlr > 0.75).length
  const avgMlr    = withDebit.length
    ? withDebit.reduce((s, d) => s + d.actual_mlr, 0) / withDebit.length
    : 0
  const totalClaims = withDebit.reduce((s, d) => s + d.total_actual_medical_cost, 0)

  const cards = [
    {
      label:    'Clients Above 75% MLR',
      value:    String(above75),
      sub:      `out of ${withDebit.length} active clients`,
      icon:     'warning',
      iconBg:   'bg-amber-500/10',
      iconColor:'text-amber-500',
    },
    {
      label:    'Portfolio Average MLR',
      value:    `${(avgMlr * 100).toFixed(1)}%`,
      sub:      'Break-even threshold: 75.0%',
      icon:     'insights',
      iconBg:   'bg-[#137fec]/10',
      iconColor:'text-[#137fec]',
      valueColor: avgMlr > 0.75 ? 'text-rose-500' : avgMlr > 0.70 ? 'text-amber-500' : 'text-emerald-600',
    },
    {
      label:    'Total Medical Cost',
      value:    fmt(totalClaims),
      sub:      'Actual claims + unclaimed PA',
      icon:     'payments',
      iconBg:   'bg-emerald-500/10',
      iconColor:'text-emerald-500',
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {cards.map((c) => (
        <div key={c.label} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{c.label}</p>
            <span className={`material-symbols-outlined ${c.iconColor} ${c.iconBg} p-1.5 rounded-lg text-xl`}>
              {c.icon}
            </span>
          </div>
          <div className="mt-4">
            <h3 className={`text-3xl font-extrabold ${c.valueColor ?? ''}`}>{c.value}</h3>
          </div>
          <p className="text-xs text-slate-400 mt-2">{c.sub}</p>
        </div>
      ))}
    </div>
  )
}
