'use client'
import { useState } from 'react'
import SummaryCards from '@/components/mlr/SummaryCards'
import BinsChart from '@/components/mlr/BinsChart'
import ClientsTable from '@/components/mlr/ClientsTable'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorCard } from '@/components/ui/ErrorCard'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui'
import { useMlrData } from '@/hooks/useMlrData'
import { MLR_THRESHOLDS } from '@/lib/constants'
import type { MLRMode } from '@/lib/types'

export default function MLRPage() {
  const { data, loading, error, refetch } = useMlrData()
  const [mode, setMode] = useState<MLRMode>('actual')
  const [refreshing, setRefreshing] = useState(false)

  if (loading) return <LoadingSpinner message="Loading MLR data..." />
  if (error)   return <ErrorCard message={error} onRetry={refetch} />

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleExport = () => {
    // TODO: Implement CSV export
    alert('Export functionality - coming soon!')
  }

  const rows        = data ?? []
  const lastUpdated = rows.length
    ? new Date(rows.reduce((max, r) => r.computed_at > max ? r.computed_at : max, rows[0].computed_at))
        .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—'

  const active  = rows.filter(r => r.total_debit_amount > 0)
  const mlrKey  = mode === 'actual' ? 'actual_mlr' : 'claims_paid_mlr'
  const total   = active.length || 1

  const breakdown = [
    { label: 'LOSS (> 75%)',      count: active.filter(r => r[mlrKey] > MLR_THRESHOLDS.LOSS).length,                                      color: 'bg-rose-500'    },
    { label: 'WARNING (70–75%)',   count: active.filter(r => r[mlrKey] > MLR_THRESHOLDS.WARNING && r[mlrKey] <= MLR_THRESHOLDS.LOSS).length, color: 'bg-amber-500'   },
    { label: 'PROFITABLE (≤ 70%)', count: active.filter(r => r[mlrKey] <= MLR_THRESHOLDS.WARNING).length,                                  color: 'bg-emerald-500' },
  ]

  return (
    <>
      <PageHeader
        title="MLR Dashboard"
        right={
          <>
            <span className="material-symbols-outlined text-sm">schedule</span>
            Last updated: {lastUpdated}
          </>
        }
      />

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Action buttons - NEW! Using production-grade Button component */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap gap-3">
            <Button
              variant="primary"
              size="md"
              loading={refreshing}
              onClick={handleRefresh}
              leftIcon={<span className="material-symbols-outlined">refresh</span>}
            >
              Refresh Data
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={handleExport}
              leftIcon={<span className="material-symbols-outlined">download</span>}
            >
              Export CSV
            </Button>
            <Button
              variant="outline"
              size="md"
              leftIcon={<span className="material-symbols-outlined">filter_list</span>}
            >
              Filters
            </Button>
          </div>
          <div className="text-sm text-slate-500">
            {rows.length} total clients • {active.length} active
          </div>
        </div>

        {/* Mode tabs */}
        <div className="border-b border-slate-200 flex gap-8">
          {(['actual', 'paid'] as MLRMode[]).map(m => (
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

        <SummaryCards data={rows} mode={mode} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <BinsChart data={rows} mode={mode} />

          {/* MLR breakdown panel */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm flex flex-col">
            <h4 className="text-lg font-bold mb-4">MLR Breakdown</h4>
            <div className="space-y-5 flex-1">
              {breakdown.map(item => (
                <div key={item.label} className="space-y-1.5">
                  <div className="flex justify-between text-sm font-medium">
                    <span>{item.label}</span>
                    <span>{item.count} clients</span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${item.color} rounded-full`}
                      style={{ width: `${Math.round((item.count / total) * 100)}%` }}
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

        <ClientsTable data={rows} mode={mode} />
      </div>
    </>
  )
}
