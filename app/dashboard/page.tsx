'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────────────────
interface KpiRow {
  id: number
  cash_collected_ytd: number; claims_paid_encounter_ytd: number; claims_paid_submitted_ytd: number
  cash_collected_sply: number; claims_paid_encounter_sply: number; claims_paid_submitted_sply: number
  mlr_encounter_pct: number; mlr_submitted_pct: number
  ytd_from: string; ytd_to: string; sply_from: string; sply_to: string
  current_year: number; last_year: number
}

interface TrendRow {
  series: string; year: number; month: number; month_label: string; value: number
}

interface ContractRow {
  id: number; group_name: string
  previous_contract_start: string | null; previous_contract_end: string | null; previous_debit: number | null
  current_contract_start: string; current_contract_end: string
  current_debit: number | null; cash_collected_current: number; cash_vs_debit_pct: number | null
}

interface Top20Row {
  id: number; category: string; rank: number; name: string
  provider_id: string | null; provider_band: string | null; amount_ytd: number
}

interface CashBreakRow {
  id: number; year: number; month: number; month_label: string
  total_cash: number; salary_palliative: number; expense: number; commission: number
  salary_palliative_pct: number; expense_pct: number; commission_pct: number
  remaining: number; remaining_pct: number
}

// ── Derived types for UI ───────────────────────────────────────────────────────
interface MonthPoint { month: number; month_label: string; current_year: number; last_year: number }
interface MLRPoint   { month: number; month_label: string; cumulative_mlr_pct: number }
interface MonthlyTrends {
  cash_collection: MonthPoint[]; claims_by_encounter: MonthPoint[]
  claims_by_submitted: MonthPoint[]; pa_cost: MonthPoint[]
  cumulative_mlr_encounter: MLRPoint[]; cumulative_mlr_submitted: MLRPoint[]
  current_year: number; last_year: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

const Mn = (n: number) => {
  if (n >= 1_000_000_000) return `₦${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000)     return `₦${(n / 1_000_000).toFixed(1)}M`
  return `₦${(n / 1_000).toFixed(0)}K`
}
const Pct = (n: number | null | undefined) => n == null ? '—' : `${n.toFixed(1)}%`
const N   = (n: number | null | undefined) => n == null ? '—'
  : `₦${n.toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`

function mlrBg(p: number)    { return p <= 60 ? 'bg-emerald-50 border-emerald-200' : p <= 80 ? 'bg-amber-50 border-amber-200' : 'bg-rose-50 border-rose-200' }
function mlrText(p: number)  { return p <= 60 ? 'text-emerald-600' : p <= 80 ? 'text-amber-600' : 'text-rose-600' }

function yoyArrow(cur: number, prev: number) {
  if (!prev) return null
  const diff = ((cur - prev) / prev) * 100
  const up = diff >= 0
  return <span className={`text-xs font-semibold ml-1 ${up ? 'text-rose-500' : 'text-emerald-500'}`}>{up ? '▲' : '▼'} {Math.abs(diff).toFixed(1)}% vs SPLY</span>
}

function buildTrends(rows: TrendRow[], cy: number, py: number): MonthlyTrends {
  const idx: Record<string, Record<number, Record<number, number>>> = {}
  for (const r of rows) {
    if (!idx[r.series])       idx[r.series] = {}
    if (!idx[r.series][r.year]) idx[r.series][r.year] = {}
    idx[r.series][r.year][r.month] = r.value
  }
  const mp = (series: string): MonthPoint[] =>
    MONTH_LABELS.map((lbl, i) => ({
      month: i + 1, month_label: lbl,
      current_year: idx[series]?.[cy]?.[i+1] ?? 0,
      last_year:    idx[series]?.[py]?.[i+1] ?? 0,
    }))
  const mlrp = (series: string): MLRPoint[] =>
    MONTH_LABELS.map((lbl, i) => ({
      month: i + 1, month_label: lbl,
      cumulative_mlr_pct: idx[series]?.[cy]?.[i+1] ?? 0,
    }))
  return {
    cash_collection:          mp('cash'),
    claims_by_encounter:      mp('claims_encounter'),
    claims_by_submitted:      mp('claims_submitted'),
    pa_cost:                  mp('pa_cost'),
    cumulative_mlr_encounter: mlrp('mlr_encounter'),
    cumulative_mlr_submitted: mlrp('mlr_submitted'),
    current_year: cy, last_year: py,
  }
}

// ── Loading / Error ────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div className="flex items-center justify-center h-64 text-slate-400">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-slate-300 border-t-[#137fec] rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm">Loading dashboard…</p>
      </div>
    </div>
  )
}
function ErrBox({ msg }: { msg: string }) {
  return (
    <div className="p-8 text-center">
      <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 text-rose-700 max-w-md mx-auto">
        <p className="font-bold">Failed to load</p>
        <p className="text-sm mt-1">{msg}</p>
      </div>
    </div>
  )
}

function SectionHead({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-lg font-bold text-slate-800">{title}</h2>
      {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
    </div>
  )
}

// ── SECTION 1 — Summary Cards ──────────────────────────────────────────────────
function SummarySection({ d }: { d: KpiRow }) {
  const CY = d.current_year, PY = d.last_year
  const cards = [
    { label: `Cash Collected ${CY}`,         val: d.cash_collected_ytd,         prev: d.cash_collected_sply,        color: 'bg-blue-50 border-blue-200',    text: 'text-blue-700'   },
    { label: `Claims (Encounter) ${CY}`,      val: d.claims_paid_encounter_ytd,   prev: d.claims_paid_encounter_sply, color: 'bg-indigo-50 border-indigo-200',text: 'text-indigo-700' },
    { label: `Claims (Submitted) ${CY}`,      val: d.claims_paid_submitted_ytd,   prev: d.claims_paid_submitted_sply, color: 'bg-violet-50 border-violet-200',text: 'text-violet-700' },
    { label: `Cash Collected ${PY}`,          val: d.cash_collected_sply,         prev: null,                         color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700'  },
    { label: `Claims (Encounter) ${PY}`,      val: d.claims_paid_encounter_sply,  prev: null,                         color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700'  },
    { label: `Claims (Submitted) ${PY}`,      val: d.claims_paid_submitted_sply,  prev: null,                         color: 'bg-slate-50 border-slate-200',  text: 'text-slate-700'  },
    { label: `MLR (Encounter) ${CY}`,         val: null, pct: d.mlr_encounter_pct, prev: null, color: mlrBg(d.mlr_encounter_pct), text: mlrText(d.mlr_encounter_pct) },
    { label: `MLR (Submitted) ${CY}`,         val: null, pct: d.mlr_submitted_pct, prev: null, color: mlrBg(d.mlr_submitted_pct), text: mlrText(d.mlr_submitted_pct) },
  ]
  return (
    <section>
      <SectionHead title="KPI Summary" subtitle={`YTD: ${d.ytd_from} → ${d.ytd_to}  ·  SPLY: ${d.sply_from} → ${d.sply_to}`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <div key={c.label} className={`rounded-xl border p-4 ${c.color}`}>
            <p className="text-xs text-slate-500 font-medium leading-tight mb-1">{c.label}</p>
            {'pct' in c && c.pct != null
              ? <p className={`text-2xl font-extrabold ${c.text}`}>{Pct(c.pct)}</p>
              : <p className={`text-xl font-extrabold ${c.text}`}>{Mn(c.val ?? 0)}</p>
            }
            {c.val != null && c.prev != null && <div className="mt-1">{yoyArrow(c.val, c.prev)}</div>}
            {c.val != null && <p className="text-xs text-slate-400 mt-0.5">{N(c.val)}</p>}
          </div>
        ))}
      </div>
    </section>
  )
}

// ── SECTION 2 — Monthly Trends ─────────────────────────────────────────────────
type TrendTab = 'cash' | 'enc' | 'sub' | 'pa' | 'mlr_enc' | 'mlr_sub'

function TrendsSection({ d }: { d: MonthlyTrends }) {
  const [tab, setTab] = useState<TrendTab>('cash')
  const TABS: { id: TrendTab; label: string }[] = [
    { id: 'cash', label: 'Cash' }, { id: 'enc', label: 'Claims (Enc)' },
    { id: 'sub',  label: 'Claims (Sub)' }, { id: 'pa', label: 'PA Cost' },
    { id: 'mlr_enc', label: 'MLR (Enc)' }, { id: 'mlr_sub', label: 'MLR (Sub)' },
  ]
  const barData: Record<string, MonthPoint[]> = {
    cash: d.cash_collection, enc: d.claims_by_encounter,
    sub:  d.claims_by_submitted, pa: d.pa_cost,
  }
  const isBar = tab in barData
  return (
    <section>
      <SectionHead title="Monthly Trends" subtitle="Current year vs same period last year" />
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap -mb-px
              ${tab === t.id ? 'border-[#137fec] text-[#137fec]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      {isBar && (
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={barData[tab]} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => Mn(v)} tick={{ fontSize: 11 }} width={72} />
            <Tooltip formatter={(v: number | undefined) => Mn(v ?? 0)} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="current_year" name={`${d.current_year}`} fill="#137fec" radius={[3,3,0,0]} />
            <Bar dataKey="last_year"    name={`${d.last_year}`}    fill="#94a3b8" radius={[3,3,0,0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
      {!isBar && (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart
            data={tab === 'mlr_enc' ? d.cumulative_mlr_encounter : d.cumulative_mlr_submitted}
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="month_label" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={52} domain={[0, 'auto']} />
            <Tooltip formatter={(v: number | undefined) => `${(v ?? 0).toFixed(1)}%`} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Line type="monotone" dataKey="cumulative_mlr_pct" name="Cumulative MLR %"
              stroke="#ef4444" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}

// ── SECTION 3 — Contract Summary ───────────────────────────────────────────────
function ContractSection({ rows }: { rows: ContractRow[] }) {
  const [search, setSearch] = useState('')
  const filtered = rows.filter(r => r.group_name.toLowerCase().includes(search.toLowerCase()))
  return (
    <section>
      <SectionHead title="Contract Summary" subtitle="Previous debit · Current debit · Cash collected per active contract" />
      <input type="text" placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)}
        className="mb-3 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] w-64" />
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Company','Prev Contract','Prev Debit','Cur Contract','Cur Debit','Cash Collected','Cash / Debit'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => {
              const p = r.cash_vs_debit_pct
              const pc = p == null ? '' : p >= 100 ? 'text-emerald-600 font-bold' : p >= 75 ? 'text-amber-600' : 'text-rose-600'
              return (
                <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-800 max-w-[200px] truncate">{r.group_name}</td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {r.previous_contract_start ? `${r.previous_contract_start} → ${r.previous_contract_end}` : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.previous_debit != null ? Mn(r.previous_debit) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">{r.current_contract_start} → {r.current_contract_end}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{r.current_debit != null ? Mn(r.current_debit) : <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{Mn(r.cash_collected_current)}</td>
                  <td className={`px-4 py-3 tabular-nums whitespace-nowrap ${pc}`}>{Pct(p)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {!filtered.length && <p className="text-center py-8 text-slate-400 text-sm">No results</p>}
      </div>
      <p className="text-xs text-slate-400 mt-2">{filtered.length} of {rows.length} companies</p>
    </section>
  )
}

// ── SECTION 4 — Top 20 ────────────────────────────────────────────────────────
type Top20Tab = 'pa_clients' | 'pa_providers' | 'claims_enc_clients' | 'claims_sub_clients'

function Top20Section({ rows }: { rows: Top20Row[] }) {
  const [tab, setTab] = useState<Top20Tab>('pa_clients')
  const TABS: { id: Top20Tab; label: string }[] = [
    { id: 'pa_clients',          label: 'Top Clients (PA)' },
    { id: 'pa_providers',        label: 'Top Providers (PA)' },
    { id: 'claims_enc_clients',  label: 'Top Clients (Claims Enc)' },
    { id: 'claims_sub_clients',  label: 'Top Clients (Claims Sub)' },
  ]
  const filtered = rows.filter(r => r.category === tab).sort((a, b) => a.rank - b.rank)
  function BandBadge({ band }: { band: string | null }) {
    if (!band) return <span className="text-slate-300">—</span>
    const k = band.trim().toUpperCase().replace(/^BAND\s?/, '')
    const colors: Record<string, string> = {
      A: 'bg-rose-100 text-rose-700', B: 'bg-amber-100 text-amber-700',
      C: 'bg-sky-100 text-sky-700',   D: 'bg-emerald-100 text-emerald-700',
    }
    return <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full ${colors[k] ?? 'bg-slate-100 text-slate-600'}`}>{band}</span>
  }
  return (
    <section>
      <SectionHead title="Top 20 YTD" subtitle="Year-to-date costs by PA and claims" />
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold border-b-2 transition-all whitespace-nowrap -mb-px
              ${tab === t.id ? 'border-[#137fec] text-[#137fec]' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
            {t.label}
          </button>
        ))}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
              {tab === 'pa_providers' ? (
                <>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Provider</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Band</th>
                </>
              ) : (
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">Company</th>
              )}
              <th className="px-4 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wide">Amount YTD</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => (
              <tr key={r.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{r.rank}</td>
                {tab === 'pa_providers' ? (
                  <>
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-800">{r.name}</div>
                      {r.provider_id && <div className="text-xs text-slate-400 font-mono">ID: {r.provider_id}</div>}
                    </td>
                    <td className="px-4 py-3"><BandBadge band={r.provider_band} /></td>
                  </>
                ) : (
                  <td className="px-4 py-3 font-medium text-slate-800">{r.name}</td>
                )}
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-[#137fec]">{Mn(r.amount_ytd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── SECTION 5 — Cash Breakdown ─────────────────────────────────────────────────
function CashBreakSection({ rows }: { rows: CashBreakRow[] }) {
  const years = [...new Set(rows.map(r => r.year))].sort()
  const [mode, setMode]   = useState<'pct' | 'amount'>('pct')
  const [year, setYear]   = useState<number>(years[years.length - 1] ?? 0)

  const filtered   = rows.filter(r => r.year === year)
  const chartData  = filtered.map(r => ({
    label:          r.month_label,
    'Salary & Pal': mode === 'pct' ? r.salary_palliative_pct : r.salary_palliative,
    'Expense':      mode === 'pct' ? r.expense_pct           : r.expense,
    'Commission':   mode === 'pct' ? r.commission_pct        : r.commission,
    'Remaining':    mode === 'pct' ? r.remaining_pct         : Math.max(r.remaining, 0),
  }))

  return (
    <section>
      <SectionHead title="Cash Overhead Breakdown" subtitle="Salary & palliative, expense, and commission as a fraction of cash collected" />
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {(['pct', 'amount'] as const).map(m => (
            <button key={m} onClick={() => setMode(m)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                ${mode === m ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {m === 'pct' ? '% of Cash' : 'Amount (₦)'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {years.map(y => (
            <button key={y} onClick={() => setYear(y)}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all
                ${year === y ? 'bg-white text-[#137fec] shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
              {y}
            </button>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="label" tick={{ fontSize: 11 }} />
          <YAxis tickFormatter={v => mode === 'pct' ? `${v}%` : Mn(v)} tick={{ fontSize: 11 }} width={mode === 'pct' ? 40 : 72} />
          <Tooltip formatter={(v: number | undefined, name: string | undefined) => mode === 'pct' ? [`${(v ?? 0).toFixed(1)}%`, name ?? ''] : [Mn(v ?? 0), name ?? '']} />
          <Legend wrapperStyle={{ fontSize: 12 }} />
          <Bar dataKey="Salary & Pal" stackId="a" fill="#6366f1" />
          <Bar dataKey="Expense"      stackId="a" fill="#f59e0b" />
          <Bar dataKey="Commission"   stackId="a" fill="#ef4444" />
          <Bar dataKey="Remaining"    stackId="a" fill="#10b981" radius={[3,3,0,0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm mt-4">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              {['Month','Cash','Salary & Pal','Expense','Commission','Remaining','Overhead %'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map(r => {
              const oh = r.salary_palliative_pct + r.expense_pct + r.commission_pct
              return (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-700 whitespace-nowrap">{r.month_label} {r.year}</td>
                  <td className="px-4 py-3 tabular-nums whitespace-nowrap">{Mn(r.total_cash)}</td>
                  <td className="px-4 py-3 tabular-nums text-indigo-600 whitespace-nowrap">{Mn(r.salary_palliative)} <span className="text-xs text-slate-400">({r.salary_palliative_pct}%)</span></td>
                  <td className="px-4 py-3 tabular-nums text-amber-600 whitespace-nowrap">{Mn(r.expense)} <span className="text-xs text-slate-400">({r.expense_pct}%)</span></td>
                  <td className="px-4 py-3 tabular-nums text-rose-600 whitespace-nowrap">{Mn(r.commission)} <span className="text-xs text-slate-400">({r.commission_pct}%)</span></td>
                  <td className="px-4 py-3 tabular-nums text-emerald-600 whitespace-nowrap">{Mn(r.remaining)} <span className="text-xs text-slate-400">({r.remaining_pct}%)</span></td>
                  <td className={`px-4 py-3 tabular-nums font-bold whitespace-nowrap ${oh > 70 ? 'text-rose-600' : oh > 50 ? 'text-amber-600' : 'text-slate-700'}`}>{oh.toFixed(1)}%</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function ExecutiveDashboard() {
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState<string | null>(null)
  const [kpi,       setKpi]       = useState<KpiRow | null>(null)
  const [trends,    setTrends]    = useState<MonthlyTrends | null>(null)
  const [contracts, setContracts] = useState<ContractRow[]>([])
  const [top20,     setTop20]     = useState<Top20Row[]>([])
  const [cashBreak, setCashBreak] = useState<CashBreakRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [kpiRes, trendRes, contractRes, top20Res, cashRes] = await Promise.all([
        supabase.from('dashboard_kpi_cards').select('*').eq('id', 1).single(),
        supabase.from('dashboard_monthly_trends').select('*'),
        supabase.from('dashboard_contract_summary').select('*').order('group_name'),
        supabase.from('dashboard_top20').select('*'),
        supabase.from('dashboard_cash_breakdown').select('*').order('year').order('month'),
      ])

      for (const r of [kpiRes, trendRes, contractRes, top20Res, cashRes]) {
        if (r.error) throw new Error(r.error.message)
      }

      const k = kpiRes.data as KpiRow
      setKpi(k)
      setTrends(buildTrends(trendRes.data as TrendRow[], k.current_year, k.last_year))
      setContracts(contractRes.data as ContractRow[])
      setTop20(top20Res.data as Top20Row[])
      setCashBreak(cashRes.data as CashBreakRow[])
      if (k) setUpdatedAt(k.ytd_to)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  if (loading) return <Spinner />
  if (error)   return <ErrBox msg={error} />

  return (
    <>
      <header className="h-16 border-b border-slate-200 bg-white flex items-center justify-between pl-14 pr-4 md:px-8 sticky top-0 z-10">
        <h2 className="text-xl font-bold tracking-tight">Executive Dashboard</h2>
        <div className="flex items-center gap-4 text-xs text-slate-400">
          {updatedAt && <span>Data as of <span className="font-medium text-slate-600">{updatedAt}</span></span>}
          <span>Refreshes daily at 12:00 AM WAT</span>
        </div>
      </header>
      <div className="p-4 md:p-8 space-y-10">
        {kpi       && <SummarySection d={kpi} />}
        {trends    && <TrendsSection  d={trends} />}
        {contracts.length > 0 && <ContractSection rows={contracts} />}
        {top20.length > 0     && <Top20Section    rows={top20} />}
        {cashBreak.length > 0 && <CashBreakSection rows={cashBreak} />}
      </div>
    </>
  )
}
