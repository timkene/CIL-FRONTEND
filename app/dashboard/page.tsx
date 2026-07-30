'use client'
import { useEffect, useState, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts'
import { Card, KPICard, Button, Badge, Table, useToast } from '@/components/ui'
import type { Column } from '@/components/ui'

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

interface PaymentScheduleRow {
  id: number
  group_id: number
  group_name: string
  payment_pattern: string
  year: number
  month: number
  month_label: string
  installment_num: number
  total_installments: number
  expected_amount: number | null
  invoice_status: string
  invoice_number: string | null
  is_renewal_advance: boolean
  contract_start: string
  contract_end: string
  cash_received: number
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
    { label: `Cash Collected ${CY}`,         val: d.cash_collected_ytd,         prev: d.cash_collected_sply,        variant: 'info' as const    },
    { label: `Claims (Encounter) ${CY}`,      val: d.claims_paid_encounter_ytd,   prev: d.claims_paid_encounter_sply, variant: 'info' as const },
    { label: `Claims (Submitted) ${CY}`,      val: d.claims_paid_submitted_ytd,   prev: d.claims_paid_submitted_sply, variant: 'info' as const },
    { label: `Cash Collected ${PY}`,          val: d.cash_collected_sply,         prev: null,                         variant: 'default' as const  },
    { label: `Claims (Encounter) ${PY}`,      val: d.claims_paid_encounter_sply,  prev: null,                         variant: 'default' as const  },
    { label: `Claims (Submitted) ${PY}`,      val: d.claims_paid_submitted_sply,  prev: null,                         variant: 'default' as const  },
    { label: `MLR (Encounter) ${CY}`,         val: null, pct: d.mlr_encounter_pct, prev: null, mlr: d.mlr_encounter_pct },
    { label: `MLR (Submitted) ${CY}`,         val: null, pct: d.mlr_submitted_pct, prev: null, mlr: d.mlr_submitted_pct },
  ]
  return (
    <section>
      <SectionHead title="KPI Summary" subtitle={`YTD: ${d.ytd_from} → ${d.ytd_to}  ·  SPLY: ${d.sply_from} → ${d.sply_to}`} />
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {cards.map(c => (
          <KPICard
            key={c.label}
            title={c.label}
            value={'pct' in c && c.pct != null ? Pct(c.pct) : Mn(c.val ?? 0)}
            variant={c.mlr != null ? (c.mlr <= 60 ? 'success' : c.mlr <= 80 ? 'warning' : 'danger') : c.variant}
            footer={
              <div className="space-y-1">
                {c.val != null && c.prev != null && <div>{yoyArrow(c.val, c.prev)}</div>}
                {c.val != null && <p className="text-xs text-slate-400">{N(c.val)}</p>}
              </div>
            }
          />
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
          <Button
            key={t.id}
            variant={tab === t.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab(t.id)}
            className={`border-b-2 rounded-none -mb-px ${tab === t.id ? 'border-[#137fec]' : 'border-transparent'}`}
          >
            {t.label}
          </Button>
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
  const filtered = rows.filter(r => r && r.group_name?.toLowerCase().includes(search.toLowerCase()))

  const columns: Column<ContractRow>[] = [
    {
      key: 'group_name',
      header: 'Company',
      render: (row) => <span className="font-medium text-slate-800">{row?.group_name ?? '—'}</span>
    },
    {
      key: 'previous_contract_start',
      header: 'Prev Contract',
      render: (row) => (
        <span className="text-xs text-slate-500">
          {row?.previous_contract_start ? `${row.previous_contract_start} → ${row.previous_contract_end}` : <span className="text-slate-300">—</span>}
        </span>
      )
    },
    {
      key: 'previous_debit',
      header: 'Prev Debit',
      render: (row) => <span className="tabular-nums">{row?.previous_debit != null ? Mn(row.previous_debit) : <span className="text-slate-300">—</span>}</span>
    },
    {
      key: 'current_contract_start',
      header: 'Cur Contract',
      render: (row) => <span className="text-xs text-slate-600">{row?.current_contract_start ?? '—'} → {row?.current_contract_end ?? '—'}</span>
    },
    {
      key: 'current_debit',
      header: 'Cur Debit',
      render: (row) => <span className="tabular-nums">{row?.current_debit != null ? Mn(row.current_debit) : <span className="text-slate-300">—</span>}</span>
    },
    {
      key: 'cash_collected_current',
      header: 'Cash Collected',
      render: (row) => <span className="tabular-nums">{row?.cash_collected_current != null ? Mn(row.cash_collected_current) : <span className="text-slate-300">—</span>}</span>
    },
    {
      key: 'cash_vs_debit_pct',
      header: 'Cash / Debit',
      render: (row) => {
        const p = row?.cash_vs_debit_pct
        const pc = p == null ? '' : p >= 100 ? 'text-emerald-600 font-bold' : p >= 75 ? 'text-amber-600' : 'text-rose-600'
        return <span className={`tabular-nums ${pc}`}>{Pct(p)}</span>
      }
    }
  ]

  return (
    <section>
      <SectionHead title="Contract Summary" subtitle="Previous debit · Current debit · Cash collected per active contract" />
      <input type="text" placeholder="Search company…" value={search} onChange={e => setSearch(e.target.value)}
        className="mb-3 border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#137fec] w-64" />
      <Table data={filtered} columns={columns} />
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
    const variantMap: Record<string, 'danger' | 'warning' | 'info' | 'success' | 'default'> = {
      A: 'danger', B: 'warning', C: 'info', D: 'success'
    }
    return <Badge variant={variantMap[k] ?? 'default'}>{band}</Badge>
  }

  const columnsProviders: Column<Top20Row>[] = [
    { key: 'rank', header: '#', render: (row) => <span className="text-slate-400 font-mono text-xs">{row?.rank ?? '—'}</span> },
    {
      key: 'name',
      header: 'Provider',
      render: (row) => (
        <div>
          <div className="font-medium text-slate-800">{row?.name ?? '—'}</div>
          {row?.provider_id && <div className="text-xs text-slate-400 font-mono">ID: {row.provider_id}</div>}
        </div>
      )
    },
    { key: 'provider_band', header: 'Band', render: (row) => row?.provider_band ? <BandBadge band={row.provider_band} /> : <span className="text-slate-300">—</span> },
    { key: 'amount_ytd', header: 'Amount YTD', render: (row) => <span className="tabular-nums font-semibold text-[#137fec]">{row?.amount_ytd != null ? Mn(row.amount_ytd) : <span className="text-slate-300">—</span>}</span> }
  ]

  const columnsClients: Column<Top20Row>[] = [
    { key: 'rank', header: '#', render: (row) => <span className="text-slate-400 font-mono text-xs">{row?.rank ?? '—'}</span> },
    { key: 'name', header: 'Company', render: (row) => <span className="font-medium text-slate-800">{row?.name ?? '—'}</span> },
    { key: 'amount_ytd', header: 'Amount YTD', render: (row) => <span className="tabular-nums font-semibold text-[#137fec]">{row?.amount_ytd != null ? Mn(row.amount_ytd) : <span className="text-slate-300">—</span>}</span> }
  ]

  return (
    <section>
      <SectionHead title="Top 20 YTD" subtitle="Year-to-date costs by PA and claims" />
      <div className="flex gap-1 border-b border-slate-200 mb-4 overflow-x-auto">
        {TABS.map(t => (
          <Button
            key={t.id}
            variant={tab === t.id ? 'primary' : 'ghost'}
            size="sm"
            onClick={() => setTab(t.id)}
            className={`border-b-2 rounded-none -mb-px ${tab === t.id ? 'border-[#137fec]' : 'border-transparent'}`}
          >
            {t.label}
          </Button>
        ))}
      </div>
      <Table data={filtered} columns={tab === 'pa_providers' ? columnsProviders : columnsClients} />
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
            <Button
              key={m}
              variant={mode === m ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setMode(m)}
              className={mode === m ? 'bg-white shadow-sm' : ''}
            >
              {m === 'pct' ? '% of Cash' : 'Amount (₦)'}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
          {years.map(y => (
            <Button
              key={y}
              variant={year === y ? 'primary' : 'ghost'}
              size="sm"
              onClick={() => setYear(y)}
              className={year === y ? 'bg-white shadow-sm' : ''}
            >
              {y}
            </Button>
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
      <Table
        data={filtered}
        columns={[
          {
            key: 'month_label',
            header: 'Month',
            render: (row) => <span className="font-medium text-slate-700">{row?.month_label ?? '—'} {row?.year ?? ''}</span>
          },
          {
            key: 'total_cash',
            header: 'Cash',
            render: (row) => <span className="tabular-nums">{row?.total_cash != null ? Mn(row.total_cash) : <span className="text-slate-300">—</span>}</span>
          },
          {
            key: 'salary_palliative',
            header: 'Salary & Pal',
            render: (row) => (
              <span className="tabular-nums text-indigo-600">
                {row?.salary_palliative != null ? Mn(row.salary_palliative) : <span className="text-slate-300">—</span>} <span className="text-xs text-slate-400">({row?.salary_palliative_pct ?? 0}%)</span>
              </span>
            )
          },
          {
            key: 'expense',
            header: 'Expense',
            render: (row) => (
              <span className="tabular-nums text-amber-600">
                {row?.expense != null ? Mn(row.expense) : <span className="text-slate-300">—</span>} <span className="text-xs text-slate-400">({row?.expense_pct ?? 0}%)</span>
              </span>
            )
          },
          {
            key: 'commission',
            header: 'Commission',
            render: (row) => (
              <span className="tabular-nums text-rose-600">
                {row?.commission != null ? Mn(row.commission) : <span className="text-slate-300">—</span>} <span className="text-xs text-slate-400">({row?.commission_pct ?? 0}%)</span>
              </span>
            )
          },
          {
            key: 'remaining',
            header: 'Remaining',
            render: (row) => (
              <span className="tabular-nums text-emerald-600">
                {row?.remaining != null ? Mn(row.remaining) : <span className="text-slate-300">—</span>} <span className="text-xs text-slate-400">({row?.remaining_pct ?? 0}%)</span>
              </span>
            )
          },
          {
            key: 'id',
            header: 'Overhead %',
            render: (row) => {
              const oh = (row?.salary_palliative_pct ?? 0) + (row?.expense_pct ?? 0) + (row?.commission_pct ?? 0)
              return (
                <span className={`tabular-nums font-bold ${oh > 70 ? 'text-rose-600' : oh > 50 ? 'text-amber-600' : 'text-slate-700'}`}>
                  {oh.toFixed(1)}%
                </span>
              )
            }
          }
        ]}
      />
    </section>
  )
}

// ── SECTION 6 — Payment Schedule ───────────────────────────────────────────────
const PATTERN_LABEL: Record<string, string> = {
  monthly:     'Monthly',
  quarterly:   'Quarterly',
  triannually: 'Tri-annual',
  biannually:  'Bi-annual',
  annually:    'Annual',
}
const PATTERN_COLOR: Record<string, string> = {
  monthly:     'bg-violet-100 text-violet-700',
  quarterly:   'bg-sky-100 text-sky-700',
  triannually: 'bg-teal-100 text-teal-700',
  biannually:  'bg-indigo-100 text-indigo-700',
  annually:    'bg-slate-100 text-slate-600',
}

interface MonthBucket {
  key: string; year: number; month: number; month_label: string
  rows: PaymentScheduleRow[]
  total_expected: number; total_cash: number
}

function PaymentScheduleSection({ rows }: { rows: PaymentScheduleRow[] }) {
  const today = new Date()
  const curKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  const months = useMemo<MonthBucket[]>(() => {
    const map = new Map<string, MonthBucket>()
    for (const r of rows) {
      if (r.is_renewal_advance) continue
      const key = `${r.year}-${String(r.month).padStart(2, '0')}`
      if (!map.has(key)) {
        map.set(key, {
          key, year: r.year, month: r.month,
          month_label: `${r.month_label} ${r.year}`,
          rows: [], total_expected: 0, total_cash: 0,
        })
      }
      const g = map.get(key)!
      g.rows.push(r)
      g.total_expected += r.expected_amount ?? 0
      g.total_cash     += r.cash_received  ?? 0
    }
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [rows])

  const [open, setOpen] = useState<Set<string>>(new Set([curKey]))
  const toggle = (key: string) =>
    setOpen(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })

  const [search, setSearch] = useState('')

  const collectionPct = (exp: number, cash: number) =>
    exp > 0 ? Math.min(cash / exp * 100, 999) : null

  return (
    <section>
      <SectionHead
        title="Payment Schedule"
        subtitle="Expected installments per group by month · cash collected per company"
      />

      {/* search */}
      <div className="relative mb-4 w-full sm:w-64">
        <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input
          className="pl-8 pr-4 py-2 bg-slate-100 rounded-lg text-sm w-full outline-none focus:ring-2 focus:ring-[#137fec] border-none"
          placeholder="Filter by company…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-3">
        {months.map(m => {
          const filteredRows = search
            ? m.rows.filter(r => r.group_name.toLowerCase().includes(search.toLowerCase()))
            : m.rows

          if (search && filteredRows.length === 0) return null

          const isOpen    = open.has(m.key)
          const isCurrent = m.key === curKey
          const pct       = collectionPct(m.total_expected, m.total_cash)
          const pctColor  = pct == null ? '' : pct >= 100 ? 'text-emerald-600' : pct >= 60 ? 'text-amber-600' : 'text-rose-600'

          return (
            <div key={m.key}
              className={`rounded-xl border shadow-sm overflow-hidden ${isCurrent ? 'border-[#137fec]/40 ring-1 ring-[#137fec]/20' : 'border-slate-200'}`}>

              {/* Month header */}
              <button
                onClick={() => toggle(m.key)}
                className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-slate-50 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  {isCurrent && <Badge variant="info">Current</Badge>}
                  <span className="font-bold text-slate-800">{m.month_label}</span>
                  <span className="text-xs text-slate-400">{m.rows.length} group{m.rows.length !== 1 ? 's' : ''}</span>
                </div>
                <div className="flex items-center gap-6 text-sm">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400">Expected</p>
                    <p className="font-semibold text-slate-700">{Mn(m.total_expected)}</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs text-slate-400">Collected</p>
                    <p className="font-semibold text-emerald-600">{Mn(m.total_cash)}</p>
                  </div>
                  {pct != null && (
                    <span className={`text-sm font-bold ${pctColor} w-14 text-right`}>
                      {pct.toFixed(0)}%
                    </span>
                  )}
                  <span className={`text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>▼</span>
                </div>
              </button>

              {/* Companies table */}
              {isOpen && (
                <div className="border-t border-slate-100 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Company', 'Pattern', 'Expected', 'Invoice', 'Cash Received', 'Gap'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredRows.map(r => {
                        const gap  = (r.expected_amount ?? 0) - (r.cash_received ?? 0)
                        const gapColor = gap <= 0 ? 'text-emerald-600' : 'text-rose-600'
                        return (
                          <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-800 max-w-[220px] truncate">
                              {r.group_name}
                            </td>
                            <td className="px-4 py-3">
                              <Badge variant={
                                r.payment_pattern === 'monthly' ? 'info' :
                                r.payment_pattern === 'quarterly' ? 'info' :
                                r.payment_pattern === 'triannually' ? 'info' :
                                r.payment_pattern === 'biannually' ? 'info' : 'default'
                              }>
                                {PATTERN_LABEL[r.payment_pattern] ?? r.payment_pattern}
                              </Badge>
                            </td>
                            <td className="px-4 py-3 tabular-nums whitespace-nowrap font-semibold text-slate-700">
                              {r.expected_amount != null ? N(r.expected_amount) : <span className="text-slate-300">—</span>}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <Badge variant={r.invoice_status === 'raised' ? 'success' : 'warning'}>
                                {r.invoice_status === 'raised' ? '✓' : '○'} {r.invoice_status}
                              </Badge>
                              {r.invoice_number && (
                                <div className="text-xs text-slate-400 font-mono mt-0.5">{r.invoice_number}</div>
                              )}
                            </td>
                            <td className="px-4 py-3 tabular-nums whitespace-nowrap">
                              {(r.cash_received ?? 0) > 0
                                ? <span className="text-emerald-700 font-semibold">{N(r.cash_received)}</span>
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                            <td className={`px-4 py-3 tabular-nums whitespace-nowrap font-semibold ${gapColor}`}>
                              {r.expected_amount != null
                                ? (gap <= 0 ? `+${N(Math.abs(gap))}` : `-${N(gap)}`)
                                : <span className="text-slate-300">—</span>
                              }
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )
        })}
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
  const [paySched,  setPaySched]  = useState<PaymentScheduleRow[]>([])
  const [updatedAt, setUpdatedAt] = useState<string | null>(null)

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true); setError(null)
    try {
      const [kpiRes, trendRes, contractRes, top20Res, cashRes, paySchedRes] = await Promise.all([
        supabase.from('dashboard_kpi_cards').select('*').eq('id', 1).single(),
        supabase.from('dashboard_monthly_trends').select('*'),
        supabase.from('dashboard_contract_summary').select('*').order('group_name'),
        supabase.from('dashboard_top20').select('*'),
        supabase.from('dashboard_cash_breakdown').select('*').order('year').order('month'),
        supabase.from('dashboard_payment_schedule').select('*').order('year').order('month').order('group_name').limit(3000),
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
      setPaySched((paySchedRes.data ?? []) as PaymentScheduleRow[])
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
        {paySched.length > 0  && <PaymentScheduleSection rows={paySched} />}
      </div>
    </>
  )
}
