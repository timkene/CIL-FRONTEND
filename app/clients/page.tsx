'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase, MLRSummary } from '@/lib/supabase'

// ── Types ────────────────────────────────────────────────────────────────────
interface TopProvider {
  rank:          number
  provider_id:   string | null
  provider_name: string | null
  visit_count:   number
  claim_rows:    number
  total_cost:    number
  pct_of_total:  number
  rank_by:       string
}
interface TopEnrollee {
  rank:           number
  enrollee_id:    string
  enrollee_name:  string | null
  visit_count:    number
  claim_rows:     number
  total_cost:     number
  pct_of_total:   number
  rank_by:        string
}
interface TopProcedure {
  rank:           number
  procedure_code: string
  procedure_desc: string | null
  claim_count:    number
  total_cost:     number
  pct_of_total:   number
  rank_by:        string
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmt(n: number) {
  if (n >= 1_000_000) return `₦${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `₦${(n / 1_000).toFixed(0)}K`
  return `₦${n.toFixed(0)}`
}

function MlrBadge({ mlr }: { mlr: number }) {
  const pct = (mlr * 100).toFixed(1) + '%'
  if (mlr > 0.75) return <span className="text-rose-600 font-extrabold text-2xl">{pct}</span>
  if (mlr > 0.70) return <span className="text-amber-500 font-extrabold text-2xl">{pct}</span>
  return <span className="text-emerald-600 font-extrabold text-2xl">{pct}</span>
}

function PctBar({ pct }: { pct: number }) {
  const capped = Math.min(pct, 100)
  const color = pct > 75 ? '#ef4444' : pct >= 50 ? '#f59e0b' : '#22c55e'
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 bg-slate-100 rounded-full h-1.5 overflow-hidden">
        <div style={{ width: `${capped}%`, background: color }} className="h-full rounded-full" />
      </div>
      <span className="text-xs font-medium w-10 text-right">{pct.toFixed(1)}%</span>
    </div>
  )
}

// ── Top-10 table component ────────────────────────────────────────────────────
interface TableCol { header: string; render: (row: never) => React.ReactNode; align?: string }

function Top10Table({ title, icon, rows, cols, emptyMsg }: {
  title:    string
  icon:     string
  rows:     object[]
  cols:     TableCol[]
  emptyMsg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#137fec] text-lg">{icon}</span>
        <h4 className="font-bold text-sm">{title}</h4>
        <span className="ml-auto text-xs text-slate-400 font-medium">{rows.length} rows</span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
              {cols.map(c => (
                <th key={c.header} className={`px-4 py-2.5 ${c.align ?? ''}`}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.length === 0 ? (
              <tr><td colSpan={cols.length} className="px-4 py-6 text-center text-slate-300">{emptyMsg}</td></tr>
            ) : rows.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors">
                {cols.map(c => (
                  <td key={c.header} className={`px-4 py-2.5 ${c.align ?? ''}`}>
                    {c.render(row as never)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ClientAnalysisPage() {
  const [clients,   setClients]   = useState<MLRSummary[]>([])
  const [selected,  setSelected]  = useState<MLRSummary | null>(null)
  const [search,    setSearch]    = useState('')
  const [open,      setOpen]      = useState(false)
  const [loading,   setLoading]   = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  const [providers,  setProviders]  = useState<TopProvider[]>([])
  const [enrollees,  setEnrollees]  = useState<TopEnrollee[]>([])
  const [procedures, setProcedures] = useState<TopProcedure[]>([])

  // load client list
  useEffect(() => {
    supabase
      .from('mlr_summary')
      .select('*')
      .eq('had_error', false)
      .gt('total_debit_amount', 0)
      .order('group_name')
      .then(({ data }) => { setClients(data ?? []); setLoading(false) })
  }, [])

  // load top-10 tables when client selected
  useEffect(() => {
    if (!selected) return
    setDetailLoading(true)
    Promise.all([
      supabase.from('mlr_top_providers').select('*').eq('summary_id', selected.id),
      supabase.from('mlr_top_enrollees').select('*').eq('summary_id', selected.id),
      supabase.from('mlr_top_procedures').select('*').eq('summary_id', selected.id),
    ]).then(([prov, enr, proc]) => {
      setProviders((prov.data ?? []) as TopProvider[])
      setEnrollees((enr.data  ?? []) as TopEnrollee[])
      setProcedures((proc.data ?? []) as TopProcedure[])
      setDetailLoading(false)
    })
  }, [selected])

  const filtered = useMemo(() =>
    clients.filter(c => c.group_name.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  )

  // split top-10 by rank_by
  const provByCost  = providers.filter(r => r.rank_by === 'cost').sort((a, b) => a.rank - b.rank)
  const provByCount = providers.filter(r => r.rank_by === 'count').sort((a, b) => a.rank - b.rank)
  const enrByCost   = enrollees.filter(r => r.rank_by === 'cost').sort((a, b) => a.rank - b.rank)
  const enrByCount  = enrollees.filter(r => r.rank_by === 'count').sort((a, b) => a.rank - b.rank)
  const procByCost  = procedures.filter(r => r.rank_by === 'cost').sort((a, b) => a.rank - b.rank)
  const procByCount = procedures.filter(r => r.rank_by === 'count').sort((a, b) => a.rank - b.rank)

  // ── Table column definitions ──────────────────────────────────────────────
  const provCostCols: TableCol[] = [
    { header: '#',        render: (r: TopProvider) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Provider', render: (r: TopProvider) => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
    { header: 'Visits',   render: (r: TopProvider) => r.visit_count.toLocaleString(), align: 'text-right' },
    { header: 'Total Cost', render: (r: TopProvider) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
    { header: '% of Total', render: (r: TopProvider) => <PctBar pct={r.pct_of_total} />, align: 'w-32' },
  ]
  const provCountCols: TableCol[] = [
    { header: '#',        render: (r: TopProvider) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Provider', render: (r: TopProvider) => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
    { header: 'Visits',   render: (r: TopProvider) => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
    { header: 'Claims',   render: (r: TopProvider) => r.claim_rows.toLocaleString(), align: 'text-right' },
    { header: 'Cost',     render: (r: TopProvider) => fmt(r.total_cost), align: 'text-right' },
  ]
  const enrCostCols: TableCol[] = [
    { header: '#',        render: (r: TopEnrollee) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Enrollee', render: (r: TopEnrollee) => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
    { header: 'Visits',   render: (r: TopEnrollee) => r.visit_count.toLocaleString(), align: 'text-right' },
    { header: 'Total Cost', render: (r: TopEnrollee) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
    { header: '% of Total', render: (r: TopEnrollee) => <PctBar pct={r.pct_of_total} />, align: 'w-32' },
  ]
  const enrCountCols: TableCol[] = [
    { header: '#',        render: (r: TopEnrollee) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Enrollee', render: (r: TopEnrollee) => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
    { header: 'Visits',   render: (r: TopEnrollee) => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
    { header: 'Claims',   render: (r: TopEnrollee) => r.claim_rows.toLocaleString(), align: 'text-right' },
    { header: 'Cost',     render: (r: TopEnrollee) => fmt(r.total_cost), align: 'text-right' },
  ]
  const procCostCols: TableCol[] = [
    { header: '#',         render: (r: TopProcedure) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Procedure', render: (r: TopProcedure) => (
      <div>
        <p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p>
        <p className="text-slate-400 text-[10px]">{r.procedure_code}</p>
      </div>
    )},
    { header: 'Claims',    render: (r: TopProcedure) => r.claim_count.toLocaleString(), align: 'text-right' },
    { header: 'Total Cost', render: (r: TopProcedure) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
    { header: '% of Total', render: (r: TopProcedure) => <PctBar pct={r.pct_of_total} />, align: 'w-32' },
  ]
  const procCountCols: TableCol[] = [
    { header: '#',         render: (r: TopProcedure) => <span className="text-slate-400 font-medium">{r.rank}</span> },
    { header: 'Procedure', render: (r: TopProcedure) => (
      <div>
        <p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p>
        <p className="text-slate-400 text-[10px]">{r.procedure_code}</p>
      </div>
    )},
    { header: 'Claims',    render: (r: TopProcedure) => <span className="font-bold">{r.claim_count.toLocaleString()}</span>, align: 'text-right' },
    { header: 'Cost',      render: (r: TopProcedure) => fmt(r.total_cost), align: 'text-right' },
  ]

  // ── Stat cards ────────────────────────────────────────────────────────────
  const statCards = selected ? [
    {
      label: 'Actual MLR',
      value: <MlrBadge mlr={selected.actual_mlr} />,
      sub:   selected.actual_mlr_pct,
      icon:  'monitoring',
      iconBg: selected.actual_mlr > 0.75 ? 'bg-rose-500/10' : selected.actual_mlr > 0.70 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      iconColor: selected.actual_mlr > 0.75 ? 'text-rose-500' : selected.actual_mlr > 0.70 ? 'text-amber-500' : 'text-emerald-600',
    },
    {
      label: 'Claims-Paid MLR',
      value: <MlrBadge mlr={selected.claims_paid_mlr} />,
      sub:   selected.claims_paid_mlr_pct,
      icon:  'receipt_long',
      iconBg: selected.claims_paid_mlr > 0.75 ? 'bg-rose-500/10' : selected.claims_paid_mlr > 0.70 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      iconColor: selected.claims_paid_mlr > 0.75 ? 'text-rose-500' : selected.claims_paid_mlr > 0.70 ? 'text-amber-500' : 'text-emerald-600',
    },
    {
      label: 'Member Utilization',
      value: <span className={`font-extrabold text-2xl ${
        (selected.member_utilization_pct ?? 0) > 75 ? 'text-rose-600' :
        (selected.member_utilization_pct ?? 0) >= 50 ? 'text-amber-500' : 'text-emerald-600'
      }`}>{selected.member_utilization_pct != null ? `${selected.member_utilization_pct.toFixed(1)}%` : '—'}</span>,
      sub:   `${selected.utilized_members ?? 0} of ${selected.enrolled_members} members`,
      icon:  'group',
      iconBg: 'bg-[#137fec]/10',
      iconColor: 'text-[#137fec]',
    },
    {
      label: 'Actual PMPM',
      value: <span className="font-extrabold text-2xl text-slate-800">{fmt(selected.actual_medical_cost_pmpm)}</span>,
      sub:   'Actual medical cost per member per month',
      icon:  'local_hospital',
      iconBg: 'bg-purple-500/10',
      iconColor: 'text-purple-500',
    },
    {
      label: 'Claims-Paid PMPM',
      value: <span className="font-extrabold text-2xl text-slate-800">{fmt(selected.claims_paid_medical_cost_pmpm)}</span>,
      sub:   'Claims-paid cost per member per month',
      icon:  'payments',
      iconBg: 'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
    },
    {
      label: 'Premium PMPM',
      value: <span className="font-extrabold text-2xl text-emerald-600">{fmt(selected.premium_pmpm)}</span>,
      sub:   `₦${selected.total_debit_amount.toLocaleString()} debit ÷ ${selected.enrolled_members} members × ${selected.contract_months} mo`,
      icon:  'account_balance_wallet',
      iconBg: 'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
  ] : []

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Client Analysis</h2>
        {selected && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined text-sm">calendar_today</span>
            {selected.start_date} → {selected.end_date}
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
              selected.mlr_status === 'LOSS'    ? 'bg-rose-100 text-rose-700' :
              selected.mlr_status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                  'bg-emerald-100 text-emerald-700'
            }`}>{selected.mlr_status}</span>
          </div>
        )}
      </header>

      <div className="p-8 space-y-8">

        {/* Client selector */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                person_search
              </span>
              <input
                className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none font-medium"
                placeholder={loading ? 'Loading clients...' : `Search ${clients.length} clients...`}
                value={selected ? selected.group_name : search}
                onFocus={() => { setOpen(true); if (selected) setSearch('') }}
                onChange={e => { setSearch(e.target.value); setSelected(null); setOpen(true) }}
                onBlur={() => setTimeout(() => setOpen(false), 150)}
              />
              {open && filtered.length > 0 && (
                <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                  {filtered.map(c => (
                    <button
                      key={c.id}
                      className="w-full text-left px-4 py-2.5 hover:bg-[#137fec]/5 text-sm transition-colors border-b border-slate-50 last:border-0"
                      onMouseDown={() => { setSelected(c); setSearch(''); setOpen(false) }}
                    >
                      <span className="font-medium">{c.group_name.trim()}</span>
                      <span className={`ml-2 text-xs font-bold px-1.5 py-0.5 rounded ${
                        c.mlr_status === 'LOSS'    ? 'bg-rose-100 text-rose-700' :
                        c.mlr_status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                     'bg-emerald-100 text-emerald-700'
                      }`}>{c.mlr_status}</span>
                      <span className="float-right text-slate-400 text-xs">{c.actual_mlr_pct}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {selected && (
              <button
                className="text-slate-400 hover:text-slate-600 transition-colors"
                onClick={() => { setSelected(null); setSearch(''); setProviders([]); setEnrollees([]); setProcedures([]) }}
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            )}
          </div>
          {!selected && (
            <p className="text-xs text-slate-400 mt-3">
              Select a client above to view their detailed MLR analysis, PMPM breakdown, and top utilizers.
            </p>
          )}
        </div>

        {/* No selection state */}
        {!selected && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">manage_search</span>
            <p className="text-base font-medium text-slate-400">No client selected</p>
            <p className="text-sm mt-1">Search and select a client to see their analysis</p>
          </div>
        )}

        {/* Loading detail */}
        {selected && detailLoading && (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-[#137fec]" style={{ animation: 'spin 1s linear infinite' }}>
              progress_activity
            </span>
          </div>
        )}

        {/* Content */}
        {selected && !detailLoading && (
          <>
            {/* 6 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {statCards.map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{c.label}</p>
                    <span className={`material-symbols-outlined ${c.iconColor} ${c.iconBg} p-1.5 rounded-lg text-xl`}>{c.icon}</span>
                  </div>
                  <div className="mt-3">{c.value}</div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-tight">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Providers */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]">local_hospital</span>
                Top 10 Providers
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table
                  title="By Cost"
                  icon="payments"
                  rows={provByCost}
                  cols={provCostCols}
                  emptyMsg="No provider data"
                />
                <Top10Table
                  title="By Visit Count"
                  icon="numbers"
                  rows={provByCount}
                  cols={provCountCols}
                  emptyMsg="No provider data"
                />
              </div>
            </div>

            {/* Enrollees */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]">person</span>
                Top 10 Enrollees
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table
                  title="By Cost"
                  icon="payments"
                  rows={enrByCost}
                  cols={enrCostCols}
                  emptyMsg="No enrollee data"
                />
                <Top10Table
                  title="By Visit Count"
                  icon="numbers"
                  rows={enrByCount}
                  cols={enrCountCols}
                  emptyMsg="No enrollee data"
                />
              </div>
            </div>

            {/* Procedures */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]">medical_services</span>
                Top 10 Procedures
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table
                  title="By Cost"
                  icon="payments"
                  rows={procByCost}
                  cols={procCostCols}
                  emptyMsg="No procedure data"
                />
                <Top10Table
                  title="By Claim Count"
                  icon="numbers"
                  rows={procByCount}
                  cols={procCountCols}
                  emptyMsg="No procedure data"
                />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
