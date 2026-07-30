'use client'
import { useState, useMemo } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui'
import { useMlrClients } from '@/hooks/useMlrData'
import { fetchClientDetail } from '@/lib/repositories/mlr'
import { MLR_STATUS_CLASSES } from '@/lib/constants'
import type { MLRSummary, TopProvider, TopEnrollee, TopProcedure, ClientDetail } from '@/lib/types'
import type { ReactNode } from 'react'

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function MlrBadge({ mlr }: { mlr: number }) {
  const pct   = (mlr * 100).toFixed(1) + '%'
  const color = mlr > 0.75 ? 'text-rose-600' : mlr > 0.70 ? 'text-amber-500' : 'text-emerald-600'
  return <span className={`font-extrabold text-2xl ${color}`}>{pct}</span>
}

function PctBar({ pct }: { pct: number }) {
  const color = pct > 75 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div style={{ width: `${Math.min(pct, 100)}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span className="text-xs font-medium w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Generic Top-10 table ──────────────────────────────────────────────────────
interface ColDef<T> { header: string; render: (row: T) => ReactNode; align?: string }

function Top10Table<T extends object>({
  title, icon, rows, cols, emptyMsg,
}: {
  title: string; icon: string; rows: T[]; cols: ColDef<T>[]; emptyMsg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#137fec]" style={{ fontSize: '18px' }}>{icon}</span>
        <h4 className="font-bold text-sm">{title}</h4>
        <span className="ml-auto text-xs text-slate-400 font-medium">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              {cols.map(c => <th key={c.header} className={`px-4 py-2.5 ${c.align ?? ''}`}>{c.header}</th>)}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0
              ? <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-slate-300">{emptyMsg}</td></tr>
              : rows.map((row, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors">
                    {cols.map(c => (
                      <td key={c.header} className={`px-4 py-2.5 ${c.align ?? ''}`}>{c.render(row)}</td>
                    ))}
                  </tr>
                ))
            }
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Column definitions ────────────────────────────────────────────────────────
const provCostCols: ColDef<TopProvider>[] = [
  { header: '#',          render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Provider',   render: r => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
  { header: 'Visits',     render: r => r.visit_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: r => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: r => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const provCountCols: ColDef<TopProvider>[] = [
  { header: '#',        render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Provider', render: r => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
  { header: 'Visits',   render: r => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Claims',   render: r => r.claim_rows.toLocaleString(), align: 'text-right' },
  { header: 'Cost',     render: r => fmt(r.total_cost), align: 'text-right' },
]
const enrCostCols: ColDef<TopEnrollee>[] = [
  { header: '#',          render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Enrollee',   render: r => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
  { header: 'Visits',     render: r => r.visit_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: r => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: r => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const enrCountCols: ColDef<TopEnrollee>[] = [
  { header: '#',        render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Enrollee', render: r => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
  { header: 'Visits',   render: r => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Claims',   render: r => r.claim_rows.toLocaleString(), align: 'text-right' },
  { header: 'Cost',     render: r => fmt(r.total_cost), align: 'text-right' },
]
const procCostCols: ColDef<TopProcedure>[] = [
  { header: '#',          render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Procedure',  render: r => <div><p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p><p className="text-slate-400 text-[10px]">{r.procedure_code}</p></div> },
  { header: 'Claims',     render: r => r.claim_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: r => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: r => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const procCountCols: ColDef<TopProcedure>[] = [
  { header: '#',         render: r => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Procedure', render: r => <div><p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p><p className="text-slate-400 text-[10px]">{r.procedure_code}</p></div> },
  { header: 'Claims',    render: r => <span className="font-bold">{r.claim_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Cost',      render: r => fmt(r.total_cost), align: 'text-right' },
]

// ── Stat card builder ─────────────────────────────────────────────────────────
function buildStatCards(detail: ClientDetail) {
  const { summary: s } = detail
  const statusCls = MLR_STATUS_CLASSES[s.mlr_status as keyof typeof MLR_STATUS_CLASSES] ?? MLR_STATUS_CLASSES.PROFITABLE
  return [
    { label: 'Actual MLR',           value: <MlrBadge mlr={s.actual_mlr} />,       sub: s.actual_mlr_pct,    icon: 'monitoring',            iconBg: statusCls.icon, iconColor: statusCls.text },
    { label: 'Claims-Paid MLR',       value: <MlrBadge mlr={s.claims_paid_mlr} />,  sub: s.claims_paid_mlr_pct, icon: 'receipt_long',         iconBg: statusCls.icon, iconColor: statusCls.text },
    { label: 'Member Utilization',    value: <span className={`font-extrabold text-2xl ${(s.member_utilization_pct ?? 0) > 75 ? 'text-rose-600' : (s.member_utilization_pct ?? 0) >= 50 ? 'text-amber-500' : 'text-emerald-600'}`}>{s.member_utilization_pct != null ? `${s.member_utilization_pct.toFixed(1)}%` : '—'}</span>, sub: `${s.utilized_members ?? 0} of ${s.enrolled_members} members`, icon: 'group', iconBg: 'bg-[#137fec]/10', iconColor: 'text-[#137fec]' },
    { label: 'Actual Medical PMPM',   value: <span className="font-extrabold text-2xl text-slate-800">{fmt(s.actual_medical_cost_pmpm)}</span>,   sub: 'Actual medical cost per member per month',  icon: 'local_hospital',         iconBg: 'bg-purple-500/10', iconColor: 'text-purple-500'  },
    { label: 'Claims-Paid PMPM',      value: <span className="font-extrabold text-2xl text-slate-800">{fmt(s.claims_paid_medical_cost_pmpm)}</span>, sub: 'Claims-paid cost per member per month', icon: 'payments',               iconBg: 'bg-indigo-500/10', iconColor: 'text-indigo-500'  },
    { label: 'Premium PMPM',          value: <span className="font-extrabold text-2xl text-emerald-600">{fmt(s.premium_pmpm)}</span>,               sub: `₦${s.total_debit_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ÷ ${s.enrolled_members} members × ${s.contract_months} mo`, icon: 'account_balance_wallet', iconBg: 'bg-emerald-500/10', iconColor: 'text-emerald-500' },
  ]
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ClientAnalysisPage() {
  const { data: clients, loading: listLoading } = useMlrClients()
  const [search,        setSearch]        = useState('')
  const [open,          setOpen]          = useState(false)
  const [result,        setResult]        = useState<ClientDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError,   setDetailError]   = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return (clients ?? []).filter(c => c.group_name.toLowerCase().includes(q))
  }, [clients, search])

  async function selectClient(c: MLRSummary) {
    setSearch('')
    setOpen(false)
    setResult(null)
    setDetailError(null)
    setDetailLoading(true)
    try {
      setResult(await fetchClientDetail(c))
    } catch (e) {
      setDetailError(e instanceof Error ? e.message : 'Failed to load client detail')
    } finally {
      setDetailLoading(false)
    }
  }

  const statusCls = result
    ? MLR_STATUS_CLASSES[result.summary.mlr_status as keyof typeof MLR_STATUS_CLASSES] ?? MLR_STATUS_CLASSES.PROFITABLE
    : null

  return (
    <>
      <PageHeader
        title="Client Analysis"
        right={result && statusCls ? (
          <>
            <span className="material-symbols-outlined" style={{ fontSize: '16px' }}>calendar_today</span>
            {result.summary.start_date} → {result.summary.end_date}
            <span className={`ml-2 px-2 py-0.5 rounded font-bold ${statusCls.text} ${statusCls.bg}`}>
              {result.summary.mlr_status}
            </span>
          </>
        ) : undefined}
      />

      <div className="p-4 md:p-8 space-y-6 md:space-y-8">
        {/* Action buttons */}
        {result && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setResult(null); setSearch('') }}
              leftIcon={<span className="material-symbols-outlined">arrow_back</span>}
            >
              Back to Search
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => alert('Export functionality - coming soon!')}
              leftIcon={<span className="material-symbols-outlined">download</span>}
            >
              Export Report
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => window.print()}
              leftIcon={<span className="material-symbols-outlined">print</span>}
            >
              Print
            </Button>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none font-medium"
              placeholder={listLoading ? 'Loading clients...' : `Search ${clients?.length ?? 0} clients...`}
              value={result ? result.summary.group_name.trim() : search}
              onFocus={() => { setOpen(true); if (result) { setSearch(''); setResult(null) } }}
              onChange={e => { setSearch(e.target.value); setResult(null); setOpen(true) }}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
            />
            {open && filtered.length > 0 && (
              <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                {filtered.map(c => {
                  const cls = MLR_STATUS_CLASSES[c.mlr_status as keyof typeof MLR_STATUS_CLASSES] ?? MLR_STATUS_CLASSES.PROFITABLE
                  return (
                    <button
                      key={c.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#137fec]/5 text-sm transition-colors border-b border-slate-50 last:border-0 flex items-center"
                      onMouseDown={() => selectClient(c)}
                    >
                      <span className="font-medium flex-1">{c.group_name.trim()}</span>
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-2 ${cls.text} ${cls.bg}`}>
                        {c.mlr_status}
                      </span>
                      <span className="text-slate-400 text-xs">{c.actual_mlr_pct}</span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {!result && !detailLoading && (
            <p className="text-xs text-slate-400 mt-3">Select a client to view their detailed analysis.</p>
          )}
        </div>

        {/* States */}
        {!result && !detailLoading && !detailError && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">manage_search</span>
            <p className="text-base font-medium text-slate-400">No client selected</p>
            <p className="text-sm mt-1">Search and select a client above</p>
          </div>
        )}

        {detailLoading && <LoadingSpinner fullPage={false} />}

        {detailError && (
          <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 text-rose-700 text-sm">{detailError}</div>
        )}

        {/* Results */}
        {result && !detailLoading && (() => {
          const { summary: s } = result
          const statCards = buildStatCards(result)
          return (
            <>
              <div className="flex items-center gap-3">
                <h3 className="text-lg font-bold">{s.group_name.trim()}</h3>
                <span className="text-slate-400 text-sm">{s.start_date} → {s.end_date}</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
                {statCards.map(c => (
                  <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                    <div className="flex justify-between items-start">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{c.label}</p>
                      <span className={`material-symbols-outlined ${c.iconColor} ${c.iconBg} p-1.5 rounded-lg`} style={{ fontSize: '20px' }}>{c.icon}</span>
                    </div>
                    <div className="mt-3">{c.value}</div>
                    <p className="text-[11px] text-slate-400 mt-2 leading-tight">{c.sub}</p>
                  </div>
                ))}
              </div>

              {[
                { label: 'Top 10 Providers',  icon: 'local_hospital', costRows: result.providersCost,  countRows: result.providersCount,  costCols: provCostCols,  countCols: provCountCols,  empty: 'No provider data'  },
                { label: 'Top 10 Enrollees',   icon: 'person',         costRows: result.enrolleesCost,  countRows: result.enrolleesCount,  costCols: enrCostCols,   countCols: enrCountCols,   empty: 'No enrollee data'  },
                { label: 'Top 10 Procedures',  icon: 'medical_services', costRows: result.proceduresCost, countRows: result.proceduresCount, costCols: procCostCols,  countCols: procCountCols,  empty: 'No procedure data' },
              ].map(section => (
                <div key={section.label}>
                  <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                    <span className="material-symbols-outlined text-[#137fec]" style={{ fontSize: '20px' }}>{section.icon}</span>
                    {section.label}
                  </h3>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                    <Top10Table title="By Cost"        icon="payments" rows={section.costRows}  cols={section.costCols as ColDef<object>[]}  emptyMsg={section.empty} />
                    <Top10Table title="By Visit Count" icon="numbers"  rows={section.countRows} cols={section.countCols as ColDef<object>[]} emptyMsg={section.empty} />
                  </div>
                </div>
              ))}
            </>
          )
        })()}
      </div>
    </>
  )
}
