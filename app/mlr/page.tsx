'use client'
import { useEffect, useState } from 'react'
import { supabase, MLRSummary } from '@/lib/supabase'
import SummaryCards from '@/components/mlr/SummaryCards'
import BinsChart from '@/components/mlr/BinsChart'
import ClientsTable from '@/components/mlr/ClientsTable'

type Mode = 'actual' | 'paid'

export default function MLRPage() {
  const [data, setData]     = useState<MLRSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]   = useState<string | null>(null)
  const [mode, setMode]     = useState<Mode>('actual')

  useEffect(() => {
    async function load() {
      const { data: rows, error: err } = await supabase
        .from('mlr_summary')
        .select('*')
        .eq('had_error', false)
        .order('actual_mlr', { ascending: false })

      if (err) { setError(err.message); setLoading(false); return }
      setData(rows ?? [])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return (
    <div className="flex-1 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-slate-400">
        <span className="material-symbols-outlined animate-spin text-4xl text-[#137fec]">progress_activity</span>
        <p className="text-sm font-medium">Loading MLR data...</p>
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

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">MLR Dashboard</h2>
        <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
          <span className="material-symbols-outlined text-sm">schedule</span>
          Last updated: {data[0]?.computed_at ? new Date(data[0].computed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
        </div>
      </header>

      {/* Content */}
      <div className="p-4 md:p-8 space-y-6 md:space-y-8">

        {/* Tabs */}
        <div className="border-b border-slate-200 flex gap-8">
          {(['actual', 'paid'] as Mode[]).map(m => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`pb-3 border-b-2 text-sm font-bold tracking-wide transition-colors ${
                mode === m
                  ? 'border-[#137fec] text-[#137fec]'
                  : 'border-transparent text-slate-400 hover:text-[#137fec]'
              }`}
            >
              {m === 'actual' ? 'Actual MLR' : 'Claims-Paid MLR'}
            </button>
          ))}
        </div>

        <SummaryCards data={data} mode={mode} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <BinsChart data={data} mode={mode} />

          {/* Quick stats panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h4 className="text-lg font-bold mb-4">MLR Breakdown</h4>
            <div className="space-y-5 flex-1">
              {(() => {
                const mlrKey = mode === 'actual' ? 'actual_mlr' : 'claims_paid_mlr'
                const active = data.filter(d => d.total_debit_amount > 0)
                return [
                  { label: 'LOSS (> 75%)',       count: active.filter(d => d[mlrKey] > 0.75).length,                         color: 'bg-rose-500' },
                  { label: 'WARNING (70–75%)',    count: active.filter(d => d[mlrKey] > 0.70 && d[mlrKey] <= 0.75).length,   color: 'bg-amber-500' },
                  { label: 'PROFITABLE (≤ 70%)',  count: active.filter(d => d[mlrKey] <= 0.70).length,                       color: 'bg-emerald-500' },
                ]
              })().map(item => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{item.label}</span>
                    <span>{item.count} clients</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${data.filter(d => d.total_debit_amount > 0).length ? Math.round((item.count / data.filter(d => d.total_debit_amount > 0).length) * 100) : 0}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 p-4 bg-[#137fec]/5 rounded-lg border border-[#137fec]/20">
              <div className="flex gap-3">
                <span className="material-symbols-outlined text-[#137fec]">tips_and_updates</span>
                <p className="text-xs text-slate-600 leading-relaxed">
                  <strong>Threshold:</strong> Nigerian HMO standard — 25% overhead
                  (15% admin + 10% commission). MLR above 75% = loss territory.
                </p>
              </div>
            </div>
          </div>
        </div>

        <ClientsTable data={data} mode={mode} />
      </div>
    </>
  )
}
