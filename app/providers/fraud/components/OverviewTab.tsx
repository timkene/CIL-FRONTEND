'use client'

import { fraudApi, useFraudQuery, fmt, fmtNaira, type DateRange } from '@/lib/api/fraudApi'
import { LoadingSpinner, ErrorCard } from '@/components/ui'

interface Props { dateRange: DateRange }

function KPI({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-800 mt-1">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  )
}

export function OverviewTab({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.summary, dateRange)

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data)   return null

  const weekendPct = data.weekend_claim_pct ?? 0
  const zeroRatio  = data.total_claims > 0
    ? ((data.zero_amount_claims / data.total_claims) * 100).toFixed(1)
    : '0'

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <KPI label="Total Claims"       value={fmt(data.total_claims)}    />
        <KPI label="Unique Members"     value={fmt(data.unique_members)}  />
        <KPI label="Unique Providers"   value={fmt(data.unique_providers)}/>
        <KPI
          label="Total Approved"
          value={fmtNaira(data.total_approved)}
          sub={`Avg ${fmtNaira(data.avg_claim_amount)} / claim`}
        />
        <KPI
          label="Zero-Amount Claims"
          value={fmt(data.zero_amount_claims)}
          sub={`${zeroRatio}% of total`}
        />
        <KPI
          label="Weekend Claims"
          value={fmt(data.weekend_claims)}
          sub={`${weekendPct}% of total`}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Zero-amount signal */}
        <div className={`rounded-xl border p-4 ${parseFloat(zeroRatio) > 5
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-50'}`}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Zero-Amount Signal
          </p>
          <p className="text-sm text-slate-700">
            {parseFloat(zeroRatio) > 5
              ? `${zeroRatio}% of claims have ₦0 approved — elevated. Could indicate phantom billing adjudicated to zero or data quality issues.`
              : `${zeroRatio}% of claims have ₦0 approved — within normal range.`}
          </p>
        </div>

        {/* Weekend billing signal */}
        <div className={`rounded-xl border p-4 ${weekendPct > 15
          ? 'border-amber-200 bg-amber-50'
          : 'border-slate-200 bg-slate-50'}`}>
          <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-1">
            Weekend Billing Signal
          </p>
          <p className="text-sm text-slate-700">
            {weekendPct > 15
              ? `${weekendPct}% of claims fall on weekends — elevated. Nigerian HMO benchmark is typically under 10%.`
              : `${weekendPct}% weekend claims — within expected range for this network.`}
          </p>
        </div>
      </div>
    </div>
  )
}
