'use client'

import { useState } from 'react'
import { fraudApi, useFraudQuery, fmt, fmtNaira, type DateRange } from '@/lib/api/fraudApi'
import { LoadingSpinner, ErrorCard } from '@/components/ui'
import { FlagBadge, flagRowClass } from './FlagBadge'
import { RiskBadge, riskRowClass } from './RiskBadge'

interface Props { dateRange: DateRange }

type View = 'highcost' | 'shopping' | 'utilization' | 'identity' | 'refill' | 'collusion'

const VIEWS: { key: View; label: string }[] = [
  { key: 'highcost',    label: 'High Cost' },
  { key: 'shopping',    label: 'Provider Shopping' },
  { key: 'utilization', label: 'Excessive Utilization' },
  { key: 'identity',    label: 'Identity Lending' },
  { key: 'refill',      label: 'Drug Refill Abuse' },
  { key: 'collusion',   label: 'Collusion Risk' },
]

function SubTabs({ active, onChange }: { active: View; onChange: (v: View) => void }) {
  return (
    <div className="flex gap-1 flex-wrap border-b border-slate-100 pb-3 mb-4">
      {VIEWS.map(v => (
        <button
          key={v.key}
          onClick={() => onChange(v.key)}
          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
            active === v.key
              ? 'bg-[#137fec] text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

function TableShell({ count, children }: { count: number; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
      {children}
      <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">{count} members</div>
    </div>
  )
}

function HighCostView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.topCostMembers, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Enrollee ID', 'Name', 'Gender', 'Employer', 'Claims', 'Providers', 'Diagnoses', 'Total Approved (₦)', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${flagRowClass(r.flagged)}`}>
              <Td mono>{r.enrollee_id}</Td>
              <Td bold>{r.member_name}</Td>
              <Td>{r.gender}</Td>
              <Td>{r.employer ?? '—'}</Td>
              <Td num>{fmt(r.total_claims)}</Td>
              <Td num>{fmt(r.providers_visited)}</Td>
              <Td num>{fmt(r.distinct_diagnoses)}</Td>
              <Td num>{fmtNaira(r.total_approved)}</Td>
              <Td><FlagBadge flagged={r.flagged} reason={r.flag_reason} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function ShoppingView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.providerShopping, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Enrollee ID', 'Name', 'Employer', 'Diagnosis', 'Providers', 'Claims', 'Total Cost (₦)', 'First Visit', 'Last Visit'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className="hover:bg-amber-50/40">
              <Td mono>{r.enrollee_id}</Td>
              <Td bold>{r.member_name}</Td>
              <Td>{r.employer ?? '—'}</Td>
              <Td mono>{r.diagnosiscode}</Td>
              <Td num>
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{r.provider_count}</span>
              </Td>
              <Td num>{fmt(r.claim_count)}</Td>
              <Td num>{fmtNaira(r.total_cost)}</Td>
              <Td>{r.first_visit?.slice(0, 10)}</Td>
              <Td>{r.last_visit?.slice(0, 10)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function UtilizationView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.excessiveUtilization, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Enrollee ID', 'Name', 'Gender', 'Employer', 'Avg Visits/Mo', 'Network Avg', 'Ratio', 'Peak Month', 'Risk'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${riskRowClass(r.risk_level)}`}>
              <Td mono>{r.enrollee_id}</Td>
              <Td bold>{r.member_name}</Td>
              <Td>{r.gender}</Td>
              <Td>{r.employer ?? '—'}</Td>
              <Td num>{fmt(r.avg_visits_per_month, 1)}</Td>
              <Td num>{fmt(r.network_avg_visits_per_month, 1)}</Td>
              <Td num><span className="font-bold">{fmt(r.utilization_ratio, 1)}×</span></Td>
              <Td num>{fmt(r.peak_month_visits)}</Td>
              <Td><RiskBadge level={r.risk_level} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function IdentityView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.identityLending, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <div className="space-y-3">
      <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-3 text-sm text-rose-700">
        <strong>{data.length}</strong> gender-procedure mismatch{data.length !== 1 ? 'es' : ''} detected. These are potential identity lending cases where someone else used the enrollee's card.
      </div>
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
        <table className="w-full text-sm whitespace-nowrap">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>{['Enrollee ID', 'Name', 'Gender', 'Proc Code', 'Dx Code', 'Service Date', 'Provider', 'Approved (₦)', 'Mismatch Type'].map(h => <Th key={h}>{h}</Th>)}</tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((r, i) => (
              <tr key={i} className="hover:bg-rose-50/40 bg-rose-50/20">
                <Td mono>{r.enrollee_id}</Td>
                <Td bold>{r.member_name}</Td>
                <Td>{r.gender}</Td>
                <Td mono>{r.procedurecode}</Td>
                <Td mono>{r.diagnosiscode}</Td>
                <Td>{r.service_date?.slice(0, 10)}</Td>
                <Td>{r.provider_name}</Td>
                <Td num>{fmtNaira(r.approved_amount)}</Td>
                <td className="px-4 py-2.5 text-xs text-rose-700 font-medium">{r.mismatch_type}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">{data.length} records</div>
      </div>
    </div>
  )
}

function RefillView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.drugRefillAbuse, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Enrollee ID', 'Name', 'Drug Code', 'Refill Count', 'Avg Days Between', 'Shortest Gap', 'Early Refills', 'Total Cost (₦)', 'Risk'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${riskRowClass(r.risk_level)}`}>
              <Td mono>{r.enrollee_id}</Td>
              <Td bold>{r.member_name}</Td>
              <Td mono>{r.drug_code}</Td>
              <Td num>{fmt(r.refill_count)}</Td>
              <Td num>{fmt(r.avg_days_between_refills, 1)} days</Td>
              <Td num>{fmt(r.shortest_refill_gap)} days</Td>
              <Td num>{fmt(r.early_refills)}</Td>
              <Td num>{fmtNaira(r.total_drug_cost)}</Td>
              <Td><RiskBadge level={r.risk_level} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function CollusionView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.collusionRisk, dateRange)
  if (loading) return <Spinner />
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Enrollee ID', 'Name', 'Employer', 'Provider', 'Loyalty %', 'Cost at Provider (₦)', 'Total Cost (₦)', 'Claims', 'Avg Visit Gap', 'Risk Score'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => {
            const score = r.collusion_risk_score ?? 0
            const scoreCls = score >= 70 ? 'text-rose-700 font-bold' : score >= 50 ? 'text-amber-700 font-semibold' : 'text-slate-700'
            return (
              <tr key={i} className={`hover:bg-slate-50 ${score >= 70 ? 'bg-rose-50' : score >= 50 ? 'bg-amber-50/40' : ''}`}>
                <Td mono>{r.enrollee_id}</Td>
                <Td bold>{r.member_name}</Td>
                <Td>{r.employer ?? '—'}</Td>
                <Td>{r.provider_name}</Td>
                <Td num>{fmt(r.loyalty_pct, 1)}%</Td>
                <Td num>{fmtNaira(r.cost_at_provider)}</Td>
                <Td num>{fmtNaira(r.member_total_cost)}</Td>
                <Td num>{fmt(r.claims_at_provider)}</Td>
                <Td num>{r.avg_days_between_visits != null ? `${fmt(r.avg_days_between_visits, 0)}d` : '—'}</Td>
                <td className={`px-4 py-2.5 tabular-nums text-right ${scoreCls}`}>{score}/100</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </TableShell>
  )
}

export function MembersTab({ dateRange }: Props) {
  const [view, setView] = useState<View>('highcost')
  return (
    <div>
      <SubTabs active={view} onChange={setView} />
      {view === 'highcost'    && <HighCostView    dateRange={dateRange} />}
      {view === 'shopping'    && <ShoppingView    dateRange={dateRange} />}
      {view === 'utilization' && <UtilizationView dateRange={dateRange} />}
      {view === 'identity'    && <IdentityView    dateRange={dateRange} />}
      {view === 'refill'      && <RefillView      dateRange={dateRange} />}
      {view === 'collusion'   && <CollusionView   dateRange={dateRange} />}
    </div>
  )
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{children}</th>
}

function Td({ children, bold, num, mono }: { children: React.ReactNode; bold?: boolean; num?: boolean; mono?: boolean }) {
  return (
    <td className={`px-4 py-2.5 max-w-[180px] truncate ${bold ? 'font-medium text-slate-800' : 'text-slate-600'} ${num ? 'tabular-nums' : ''} ${mono ? 'font-mono text-xs' : ''}`}>
      {children}
    </td>
  )
}

function Spinner() {
  return <div className="flex justify-center py-12"><LoadingSpinner /></div>
}

function Empty() {
  return <div className="text-center py-12 text-slate-400 text-sm">No data found for this period.</div>
}
