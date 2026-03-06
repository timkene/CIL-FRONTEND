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
}
interface TopEnrollee {
  rank:           number
  enrollee_id:    string
  enrollee_name:  string | null
  visit_count:    number
  claim_rows:     number
  total_cost:     number
  pct_of_total:   number
}
interface TopProcedure {
  rank:           number
  procedure_code: string
  procedure_desc: string | null
  claim_count:    number
  total_cost:     number
  pct_of_total:   number
}

// Unified display type — populated from either Supabase or live API
interface ClientDetail {
  group_name:                   string
  start_date:                   string
  end_date:                     string
  total_debit_amount:           number
  actual_mlr:                   number
  claims_paid_mlr:              number
  actual_mlr_pct:               string
  claims_paid_mlr_pct:          string
  mlr_status:                   string
  enrolled_members:             number
  utilized_members:             number | null
  member_utilization_pct:       number | null
  actual_medical_cost_pmpm:     number
  claims_paid_medical_cost_pmpm:number
  premium_pmpm:                 number
  contract_months:              number
  providersCost:   TopProvider[]
  providersCount:  TopProvider[]
  enrolleesCost:   TopEnrollee[]
  enrolleesCount:  TopEnrollee[]
  proceduresCost:  TopProcedure[]
  proceduresCount: TopProcedure[]
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
interface ColDef { header: string; render: (row: never) => React.ReactNode; align?: string }

function Top10Table({ title, icon, rows, cols, emptyMsg }: {
  title: string; icon: string; rows: object[]; cols: ColDef[]; emptyMsg: string
}) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
        <span className="material-symbols-outlined text-[#137fec]" style={{fontSize:'18px'}}>{icon}</span>
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
                      <td key={c.header} className={`px-4 py-2.5 ${c.align ?? ''}`}>{c.render(row as never)}</td>
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
const provCostCols: ColDef[] = [
  { header: '#',          render: (r: TopProvider) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Provider',   render: (r: TopProvider) => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
  { header: 'Visits',     render: (r: TopProvider) => r.visit_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: (r: TopProvider) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: (r: TopProvider) => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const provCountCols: ColDef[] = [
  { header: '#',        render: (r: TopProvider) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Provider', render: (r: TopProvider) => <span className="font-medium">{r.provider_name ?? r.provider_id ?? '—'}</span> },
  { header: 'Visits',   render: (r: TopProvider) => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Claims',   render: (r: TopProvider) => r.claim_rows.toLocaleString(), align: 'text-right' },
  { header: 'Cost',     render: (r: TopProvider) => fmt(r.total_cost), align: 'text-right' },
]
const enrCostCols: ColDef[] = [
  { header: '#',          render: (r: TopEnrollee) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Enrollee',   render: (r: TopEnrollee) => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
  { header: 'Visits',     render: (r: TopEnrollee) => r.visit_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: (r: TopEnrollee) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: (r: TopEnrollee) => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const enrCountCols: ColDef[] = [
  { header: '#',        render: (r: TopEnrollee) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Enrollee', render: (r: TopEnrollee) => <span className="font-medium">{r.enrollee_name ?? r.enrollee_id}</span> },
  { header: 'Visits',   render: (r: TopEnrollee) => <span className="font-bold">{r.visit_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Claims',   render: (r: TopEnrollee) => r.claim_rows.toLocaleString(), align: 'text-right' },
  { header: 'Cost',     render: (r: TopEnrollee) => fmt(r.total_cost), align: 'text-right' },
]
const procCostCols: ColDef[] = [
  { header: '#',          render: (r: TopProcedure) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Procedure',  render: (r: TopProcedure) => (
    <div><p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p><p className="text-slate-400 text-[10px]">{r.procedure_code}</p></div>
  )},
  { header: 'Claims',     render: (r: TopProcedure) => r.claim_count.toLocaleString(), align: 'text-right' },
  { header: 'Total Cost', render: (r: TopProcedure) => <span className="font-bold">{fmt(r.total_cost)}</span>, align: 'text-right' },
  { header: '% of Total', render: (r: TopProcedure) => <PctBar pct={r.pct_of_total} />, align: 'w-36' },
]
const procCountCols: ColDef[] = [
  { header: '#',         render: (r: TopProcedure) => <span className="text-slate-400 font-medium">{r.rank}</span> },
  { header: 'Procedure', render: (r: TopProcedure) => (
    <div><p className="font-medium">{r.procedure_desc ?? r.procedure_code}</p><p className="text-slate-400 text-[10px]">{r.procedure_code}</p></div>
  )},
  { header: 'Claims',   render: (r: TopProcedure) => <span className="font-bold">{r.claim_count.toLocaleString()}</span>, align: 'text-right' },
  { header: 'Cost',     render: (r: TopProcedure) => fmt(r.total_cost), align: 'text-right' },
]

// ── Map API response → ClientDetail ──────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapApiResponse(d: any, clientName: string): ClientDetail {
  return {
    group_name:                   d.client_name ?? clientName,
    start_date:                   typeof d.start_date === 'string' ? d.start_date : String(d.start_date),
    end_date:                     typeof d.end_date   === 'string' ? d.end_date   : String(d.end_date),
    total_debit_amount:           d.total_debit_amount,
    actual_mlr:                   d.actual_mlr,
    claims_paid_mlr:              d.claims_paid_mlr,
    actual_mlr_pct:               d.actual_mlr_pct,
    claims_paid_mlr_pct:          d.claims_paid_mlr_pct,
    mlr_status:                   d.mlr_status,
    enrolled_members:             d.enrolled_members,
    utilized_members:             d.utilized_members ?? null,
    member_utilization_pct:       d.member_utilization_pct ?? null,
    actual_medical_cost_pmpm:     d.actual_medical_cost_pmpm,
    claims_paid_medical_cost_pmpm:d.claims_paid_medical_cost_pmpm,
    premium_pmpm:                 d.premium_pmpm,
    contract_months:              d.contract_months ?? 12,
    providersCost:   (d.top_10_providers_by_cost   ?? []) as TopProvider[],
    providersCount:  (d.top_10_providers_by_count  ?? []) as TopProvider[],
    enrolleesCost:   (d.top_10_enrollees_by_cost   ?? []) as TopEnrollee[],
    enrolleesCount:  (d.top_10_enrollees_by_count  ?? []) as TopEnrollee[],
    proceduresCost:  (d.top_10_procedures_by_cost  ?? []) as TopProcedure[],
    proceduresCount: (d.top_10_procedures_by_count ?? []) as TopProcedure[],
  }
}

// ── Main page ────────────────────────────────────────────────────────────────
export default function ClientAnalysisPage() {
  // shared
  const [mode, setMode] = useState<'saved' | 'custom'>('saved')
  const [result, setResult] = useState<ClientDetail | null>(null)

  // saved-mode state
  const [clients,   setClients]   = useState<MLRSummary[]>([])
  const [search,    setSearch]    = useState('')
  const [open,      setOpen]      = useState(false)
  const [listLoading, setListLoading] = useState(true)

  // custom-mode state
  const [customName,  setCustomName]  = useState('')
  const [customStart, setCustomStart] = useState('')
  const [customEnd,   setCustomEnd]   = useState('')
  const [apiLoading,  setApiLoading]  = useState(false)
  const [apiError,    setApiError]    = useState<string | null>(null)

  // detail loading (Supabase top tables)
  const [detailLoading, setDetailLoading] = useState(false)

  // load client list for saved mode
  useEffect(() => {
    supabase
      .from('mlr_summary')
      .select('*')
      .eq('had_error', false)
      .gt('total_debit_amount', 0)
      .order('group_name')
      .then(({ data }) => { setClients(data ?? []); setListLoading(false) })
  }, [])

  const filtered = useMemo(() =>
    clients.filter(c => c.group_name.toLowerCase().includes(search.toLowerCase())),
    [clients, search]
  )

  // select a saved client → load from Supabase
  async function selectSavedClient(c: MLRSummary) {
    setSearch('')
    setOpen(false)
    setResult(null)
    setDetailLoading(true)

    const [provRes, enrRes, procRes] = await Promise.all([
      supabase.from('mlr_top_providers').select('*').eq('summary_id', c.id),
      supabase.from('mlr_top_enrollees').select('*').eq('summary_id', c.id),
      supabase.from('mlr_top_procedures').select('*').eq('summary_id', c.id),
    ])

    const byRank = (a: {rank:number;rank_by:string}, b: {rank:number;rank_by:string}) => a.rank - b.rank
    const providers  = (provRes.data  ?? []) as (TopProvider  & {rank_by:string})[]
    const enrollees  = (enrRes.data   ?? []) as (TopEnrollee  & {rank_by:string})[]
    const procedures = (procRes.data  ?? []) as (TopProcedure & {rank_by:string})[]

    setResult({
      group_name:                    c.group_name.trim(),
      start_date:                    c.start_date,
      end_date:                      c.end_date,
      total_debit_amount:            c.total_debit_amount,
      actual_mlr:                    c.actual_mlr,
      claims_paid_mlr:               c.claims_paid_mlr,
      actual_mlr_pct:                c.actual_mlr_pct,
      claims_paid_mlr_pct:           c.claims_paid_mlr_pct,
      mlr_status:                    c.mlr_status,
      enrolled_members:              c.enrolled_members,
      utilized_members:              c.utilized_members,
      member_utilization_pct:        c.member_utilization_pct,
      actual_medical_cost_pmpm:      c.actual_medical_cost_pmpm,
      claims_paid_medical_cost_pmpm: c.claims_paid_medical_cost_pmpm,
      premium_pmpm:                  c.premium_pmpm,
      contract_months:               c.contract_months,
      providersCost:   providers.filter(r => r.rank_by === 'cost').sort(byRank),
      providersCount:  providers.filter(r => r.rank_by === 'count').sort(byRank),
      enrolleesCost:   enrollees.filter(r => r.rank_by === 'cost').sort(byRank),
      enrolleesCount:  enrollees.filter(r => r.rank_by === 'count').sort(byRank),
      proceduresCost:  procedures.filter(r => r.rank_by === 'cost').sort(byRank),
      proceduresCount: procedures.filter(r => r.rank_by === 'count').sort(byRank),
    })
    setDetailLoading(false)
  }

  const mlrApiUrl = process.env.NEXT_PUBLIC_MLR_API_URL ?? ''

  // run custom period analysis via API (browser → MLR API directly, CORS enabled)
  async function runCustomAnalysis() {
    if (!customName.trim() || !customStart || !customEnd) return
    if (!mlrApiUrl) {
      setApiError('NEXT_PUBLIC_MLR_API_URL is not set. Add it to your .env.local (e.g. http://localhost:8004) and restart the dev server.')
      return
    }
    setApiError(null)
    setResult(null)
    setApiLoading(true)

    try {
      const params = new URLSearchParams({
        client_name: customName.trim(),
        start_date:  customStart,
        end_date:    customEnd,
      })
      const res = await fetch(`${mlrApiUrl}/mlr/summary?${params}`)
      const data = await res.json()
      if (!res.ok) {
        setApiError(data.detail ?? data.error ?? `API returned ${res.status}`)
      } else {
        setResult(mapApiResponse(data, customName.trim()))
      }
    } catch {
      setApiError(`Cannot reach MLR API at ${mlrApiUrl}. Make sure it is running (uvicorn apis.mlr.main:app --port 8004).`)
    } finally {
      setApiLoading(false)
    }
  }

  // stat cards from result
  const statCards = result ? [
    {
      label: 'Actual MLR',
      value: <MlrBadge mlr={result.actual_mlr} />,
      sub:   result.actual_mlr_pct,
      icon:  'monitoring',
      iconBg:    result.actual_mlr > 0.75 ? 'bg-rose-500/10'    : result.actual_mlr > 0.70 ? 'bg-amber-500/10'    : 'bg-emerald-500/10',
      iconColor: result.actual_mlr > 0.75 ? 'text-rose-500'     : result.actual_mlr > 0.70 ? 'text-amber-500'     : 'text-emerald-600',
    },
    {
      label: 'Claims-Paid MLR',
      value: <MlrBadge mlr={result.claims_paid_mlr} />,
      sub:   result.claims_paid_mlr_pct,
      icon:  'receipt_long',
      iconBg:    result.claims_paid_mlr > 0.75 ? 'bg-rose-500/10' : result.claims_paid_mlr > 0.70 ? 'bg-amber-500/10' : 'bg-emerald-500/10',
      iconColor: result.claims_paid_mlr > 0.75 ? 'text-rose-500'  : result.claims_paid_mlr > 0.70 ? 'text-amber-500'  : 'text-emerald-600',
    },
    {
      label: 'Member Utilization',
      value: <span className={`font-extrabold text-2xl ${
        (result.member_utilization_pct ?? 0) > 75 ? 'text-rose-600' :
        (result.member_utilization_pct ?? 0) >= 50 ? 'text-amber-500' : 'text-emerald-600'
      }`}>{result.member_utilization_pct != null ? `${result.member_utilization_pct.toFixed(1)}%` : '—'}</span>,
      sub:   `${result.utilized_members ?? 0} of ${result.enrolled_members} members`,
      icon:  'group',
      iconBg:    'bg-[#137fec]/10',
      iconColor: 'text-[#137fec]',
    },
    {
      label: 'Actual Medical PMPM',
      value: <span className="font-extrabold text-2xl text-slate-800">{fmt(result.actual_medical_cost_pmpm)}</span>,
      sub:   'Actual medical cost per member per month',
      icon:  'local_hospital',
      iconBg:    'bg-purple-500/10',
      iconColor: 'text-purple-500',
    },
    {
      label: 'Claims-Paid PMPM',
      value: <span className="font-extrabold text-2xl text-slate-800">{fmt(result.claims_paid_medical_cost_pmpm)}</span>,
      sub:   'Claims-paid cost per member per month',
      icon:  'payments',
      iconBg:    'bg-indigo-500/10',
      iconColor: 'text-indigo-500',
    },
    {
      label: 'Premium PMPM',
      value: <span className="font-extrabold text-2xl text-emerald-600">{fmt(result.premium_pmpm)}</span>,
      sub:   `₦${result.total_debit_amount.toLocaleString(undefined,{maximumFractionDigits:0})} ÷ ${result.enrolled_members} members × ${result.contract_months} mo`,
      icon:  'account_balance_wallet',
      iconBg:    'bg-emerald-500/10',
      iconColor: 'text-emerald-500',
    },
  ] : []

  const loading = detailLoading || apiLoading

  return (
    <>
      {/* Header */}
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Client Analysis</h2>
        {result && (
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span className="material-symbols-outlined" style={{fontSize:'16px'}}>calendar_today</span>
            {result.start_date} → {result.end_date}
            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-bold ${
              result.mlr_status === 'LOSS'    ? 'bg-rose-100 text-rose-700' :
              result.mlr_status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                'bg-emerald-100 text-emerald-700'
            }`}>{result.mlr_status}</span>
          </div>
        )}
      </header>

      <div className="p-8 space-y-8">

        {/* Mode selector + inputs */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">

          {/* Mode tabs */}
          <div className="flex border-b border-slate-100">
            <button
              onClick={() => { setMode('saved'); setResult(null); setApiError(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                mode === 'saved'
                  ? 'bg-[#137fec]/5 text-[#137fec] border-b-2 border-[#137fec]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined leading-none" style={{fontSize:'18px'}}>database</span>
              Saved Analysis
            </button>
            <button
              onClick={() => { setMode('custom'); setResult(null); setApiError(null) }}
              className={`flex-1 flex items-center justify-center gap-2 py-3.5 text-sm font-semibold transition-colors ${
                mode === 'custom'
                  ? 'bg-[#137fec]/5 text-[#137fec] border-b-2 border-[#137fec]'
                  : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <span className="material-symbols-outlined leading-none" style={{fontSize:'18px'}}>tune</span>
              Custom Period
            </button>
          </div>

          <div className="p-6">
            {/* ── Saved mode ── */}
            {mode === 'saved' && (
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 leading-none" style={{fontSize:'18px'}}>search</span>
                <input
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none font-medium"
                  placeholder={listLoading ? 'Loading clients...' : `Search ${clients.length} clients...`}
                  value={result ? result.group_name : search}
                  onFocus={() => { setOpen(true); if (result) { setSearch(''); setResult(null) } }}
                  onChange={e => { setSearch(e.target.value); setResult(null); setOpen(true) }}
                  onBlur={() => setTimeout(() => setOpen(false), 150)}
                />
                {open && filtered.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-lg max-h-72 overflow-y-auto">
                    {filtered.map(c => (
                      <button
                        key={c.id}
                        className="w-full text-left px-4 py-2.5 hover:bg-[#137fec]/5 text-sm transition-colors border-b border-slate-50 last:border-0 flex items-center"
                        onMouseDown={() => selectSavedClient(c)}
                      >
                        <span className="font-medium flex-1">{c.group_name.trim()}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded mr-2 ${
                          c.mlr_status === 'LOSS'    ? 'bg-rose-100 text-rose-700' :
                          c.mlr_status === 'WARNING' ? 'bg-amber-100 text-amber-700' :
                                                       'bg-emerald-100 text-emerald-700'
                        }`}>{c.mlr_status}</span>
                        <span className="text-slate-400 text-xs">{c.actual_mlr_pct}</span>
                      </button>
                    ))}
                  </div>
                )}
                <p className="text-xs text-slate-400 mt-3">
                  Reads pre-computed data from the summary table. Instant results.
                </p>
              </div>
            )}

            {/* ── Custom mode ── */}
            {mode === 'custom' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="relative md:col-span-1">
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">Client Name</label>
                    <span className="material-symbols-outlined absolute left-3 top-[calc(1.5rem+10px)] -translate-y-1/2 text-slate-400 leading-none" style={{fontSize:'18px'}}>search</span>
                    <input
                      className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none"
                      placeholder="e.g. Arik Air"
                      value={customName}
                      onChange={e => setCustomName(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">Start Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none"
                      value={customStart}
                      onChange={e => setCustomStart(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-slate-500 block mb-1.5">End Date</label>
                    <input
                      type="date"
                      className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-[#137fec] outline-none"
                      value={customEnd}
                      onChange={e => setCustomEnd(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    onClick={runCustomAnalysis}
                    disabled={!customName.trim() || !customStart || !customEnd || apiLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-[#137fec] text-white rounded-lg text-sm font-semibold hover:bg-[#0f6fd4] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {apiLoading
                      ? <span className="material-symbols-outlined leading-none" style={{fontSize:'16px', animation:'spin 1s linear infinite'}}>progress_activity</span>
                      : <span className="material-symbols-outlined leading-none" style={{fontSize:'16px'}}>play_arrow</span>
                    }
                    {apiLoading ? 'Running...' : 'Run Analysis'}
                  </button>
                  <p className="text-xs text-slate-400">
                    {mlrApiUrl
                      ? <>Live query via <span className="font-mono text-slate-500">{mlrApiUrl}</span></>
                      : <span className="text-amber-600 font-medium">Set NEXT_PUBLIC_MLR_API_URL in .env.local to enable this feature</span>
                    }
                  </p>
                </div>
                {apiError && (
                  <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-700 text-sm flex items-start gap-2">
                    <span className="material-symbols-outlined leading-none mt-0.5" style={{fontSize:'16px'}}>error</span>
                    <span>{apiError}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Empty state */}
        {!result && !loading && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-300">
            <span className="material-symbols-outlined text-6xl mb-4">manage_search</span>
            <p className="text-base font-medium text-slate-400">No client selected</p>
            <p className="text-sm mt-1">
              {mode === 'saved'
                ? 'Search and select a client above'
                : 'Enter a client name and date range, then click Run Analysis'}
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-16">
            <span className="material-symbols-outlined text-4xl text-[#137fec]" style={{animation:'spin 1s linear infinite'}}>
              progress_activity
            </span>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <>
            {/* Client name banner */}
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-bold">{result.group_name}</h3>
              <span className="text-slate-400 text-sm">{result.start_date} → {result.end_date}</span>
              {mode === 'custom' && (
                <span className="text-xs bg-indigo-100 text-indigo-700 font-bold px-2 py-0.5 rounded">Live Query</span>
              )}
            </div>

            {/* 6 stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
              {statCards.map(c => (
                <div key={c.label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col justify-between">
                  <div className="flex justify-between items-start">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider leading-tight">{c.label}</p>
                    <span className={`material-symbols-outlined ${c.iconColor} ${c.iconBg} p-1.5 rounded-lg`} style={{fontSize:'20px'}}>{c.icon}</span>
                  </div>
                  <div className="mt-3">{c.value}</div>
                  <p className="text-[11px] text-slate-400 mt-2 leading-tight">{c.sub}</p>
                </div>
              ))}
            </div>

            {/* Providers */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]" style={{fontSize:'20px'}}>local_hospital</span>
                Top 10 Providers
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table title="By Cost"        icon="payments" rows={result.providersCost}  cols={provCostCols}  emptyMsg="No provider data" />
                <Top10Table title="By Visit Count" icon="numbers"  rows={result.providersCount} cols={provCountCols} emptyMsg="No provider data" />
              </div>
            </div>

            {/* Enrollees */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]" style={{fontSize:'20px'}}>person</span>
                Top 10 Enrollees
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table title="By Cost"        icon="payments" rows={result.enrolleesCost}  cols={enrCostCols}  emptyMsg="No enrollee data" />
                <Top10Table title="By Visit Count" icon="numbers"  rows={result.enrolleesCount} cols={enrCountCols} emptyMsg="No enrollee data" />
              </div>
            </div>

            {/* Procedures */}
            <div>
              <h3 className="text-base font-bold mb-3 flex items-center gap-2">
                <span className="material-symbols-outlined text-[#137fec]" style={{fontSize:'20px'}}>medical_services</span>
                Top 10 Procedures
              </h3>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                <Top10Table title="By Cost"         icon="payments" rows={result.proceduresCost}  cols={procCostCols}  emptyMsg="No procedure data" />
                <Top10Table title="By Claim Count"  icon="numbers"  rows={result.proceduresCount} cols={procCountCols} emptyMsg="No procedure data" />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
