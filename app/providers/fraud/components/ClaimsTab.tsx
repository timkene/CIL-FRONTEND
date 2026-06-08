'use client'

import { fraudApi, useFraudQuery, fmt, fmtNaira, type DateRange } from '@/lib/api/fraudApi'
import { LoadingSpinner, ErrorCard } from '@/components/ui'

interface Props { dateRange: DateRange }

export function ClaimsTab({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.duplicateClaims, dateRange)

  if (loading) return <div className="flex justify-center py-16"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data)   return null

  return (
    <div className="space-y-4">
      {/* Summary banner */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
          <p className="text-xs text-rose-600 font-semibold uppercase tracking-wide">Duplicate Groups</p>
          <p className="text-2xl font-bold text-rose-700 mt-1">{fmt(data.total_duplicate_groups)}</p>
          <p className="text-xs text-rose-500 mt-0.5">Sets of exact duplicate claim lines</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-700 font-semibold uppercase tracking-wide">Potential Recovery</p>
          <p className="text-2xl font-bold text-amber-700 mt-1">{fmtNaira(data.total_potential_recovery)}</p>
          <p className="text-xs text-amber-500 mt-0.5">Overpaid beyond first occurrence</p>
        </div>
      </div>

      {data.records.length === 0 ? (
        <div className="text-center py-12 text-slate-400">No duplicate claims found in this period.</div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
          <table className="w-full text-sm whitespace-nowrap">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                {['Member', 'Provider', 'Dx Code', 'Proc Code', 'Service Date', 'Approved (₦)', 'Duplicates', 'Total Overpaid (₦)', 'Recovery (₦)'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.records.map((r, i) => (
                <tr key={i} className="hover:bg-rose-50/40">
                  <td className="px-4 py-2.5 font-medium text-slate-800 max-w-[160px] truncate" title={r.member_name}>{r.member_name}</td>
                  <td className="px-4 py-2.5 text-slate-600 max-w-[160px] truncate" title={r.provider_name}>{r.provider_name}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{r.diagnosiscode}</td>
                  <td className="px-4 py-2.5 text-slate-600 font-mono text-xs">{r.procedurecode}</td>
                  <td className="px-4 py-2.5 text-slate-600">{r.service_date?.slice(0, 10)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-slate-700">{fmtNaira(r.approved_amount)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-center">
                    <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">×{r.duplicate_count}</span>
                  </td>
                  <td className="px-4 py-2.5 tabular-nums text-amber-700 font-medium">{fmtNaira(r.total_overpaid)}</td>
                  <td className="px-4 py-2.5 tabular-nums text-emerald-700 font-semibold">{fmtNaira(r.potential_recovery)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">
            {data.records.length} duplicate group{data.records.length !== 1 ? 's' : ''} shown
          </div>
        </div>
      )}
    </div>
  )
}
