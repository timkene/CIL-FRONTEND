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

export default function MLRPage() {
  const [page, setPage] = useState(0)
  const { data: result, loading, error, refetch } = useMlrData(page, 50)
  const [refreshing, setRefreshing] = useState(false)

  if (loading) return <LoadingSpinner message="Loading MLR data..." />
  if (error)   return <ErrorCard message={error} onRetry={refetch} />

  const handleRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const handleExport = () => {
    const rows = result?.data ?? []
    const header = ['Client', 'Group ID', 'Contract ID', 'Start', 'End', 'Debit', 'Medical Cost', 'MLR', 'Active Lives', 'Utilized Members', 'Utilization %']
    const csv = [header, ...rows.map(r => [r.group_name, r.group_id, r.contract_id, r.start_date, r.end_date ?? '', r.total_debit_amount, r.total_actual_medical_cost, r.actual_mlr, r.enrolled_members, r.utilized_members, r.member_utilization_pct])]
      .map(row => row.map(value => `"${String(value).replaceAll('"', '""')}"`).join(','))
      .join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = 'clearline-mlr.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const rows        = result?.data ?? []
  const offset       = result?.offset ?? 0
  const lastUpdated = rows.length
    ? new Date(rows.reduce((max, r) => r.fetched_at > max ? r.fetched_at : max, rows[0].fetched_at))
        .toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : '—'

  const active  = rows.filter(r => r.total_debit_amount > 0)
  const total   = active.length || 1

  const breakdown = [
    { label: 'LOSS (> 75%)',       count: active.filter(r => r.actual_mlr > MLR_THRESHOLDS.LOSS).length, color: 'bg-rose-500' },
    { label: 'WARNING (70–75%)',   count: active.filter(r => r.actual_mlr > MLR_THRESHOLDS.WARNING && r.actual_mlr <= MLR_THRESHOLDS.LOSS).length, color: 'bg-amber-500' },
    { label: 'PROFITABLE (≤ 70%)', count: active.filter(r => r.actual_mlr <= MLR_THRESHOLDS.WARNING).length, color: 'bg-emerald-500' },
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
          </div>
          <div className="text-sm text-slate-500">
            Showing {rows.length ? offset + 1 : 0}–{offset + rows.length} of {result?.total_active_contracts ?? 0} active contracts
          </div>
        </div>

        {/* Mode tabs */}
        <SummaryCards data={rows} />

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
          <BinsChart data={rows} />

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

        <ClientsTable data={rows} />

        <div className="flex items-center justify-between border-t border-slate-200 pt-4">
          <Button
            variant="secondary"
            size="md"
            disabled={page === 0 || loading}
            onClick={() => setPage(current => Math.max(0, current - 1))}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-500">Page {page + 1}</span>
          <Button
            variant="secondary"
            size="md"
            disabled={!result?.has_more || loading}
            onClick={() => setPage(current => current + 1)}
          >
            Next
          </Button>
        </div>
      </div>
    </>
  )
}
