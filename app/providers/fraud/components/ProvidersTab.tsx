'use client'

import { useState } from 'react'
import { fraudApi, useFraudQuery, fmt, fmtNaira, type DateRange } from '@/lib/api/fraudApi'
import { LoadingSpinner, ErrorCard } from '@/components/ui'
import { FlagBadge, flagRowClass } from './FlagBadge'
import { RiskBadge, riskRowClass } from './RiskBadge'

interface Props { dateRange: DateRange }

type View = 'cost' | 'admissions' | 'lab' | 'drug' | 'eom'

const VIEWS: { key: View; label: string }[] = [
  { key: 'cost',       label: 'Cost / Member' },
  { key: 'admissions', label: 'Admission Rates' },
  { key: 'lab',        label: 'Lab Cost / Consult' },
  { key: 'drug',       label: 'Drug Cost / Consult' },
  { key: 'eom',        label: 'EOM Spikes' },
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
      <div className="px-4 py-2 border-t border-slate-100 text-xs text-slate-400">{count} providers</div>
    </div>
  )
}

function CostView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.providerCostPerMember, dateRange)
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Provider', 'State', 'Members', 'Claims', 'Cost / Member (₦)', 'Avg Claim (₦)', 'Total Approved (₦)', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${flagRowClass(r.flagged)}`}>
              <Td bold>{r.provider_name}</Td>
              <Td>{r.state}</Td>
              <Td num>{fmt(r.unique_members)}</Td>
              <Td num>{fmt(r.total_claims)}</Td>
              <Td num>{fmtNaira(r.cost_per_member)}</Td>
              <Td num>{fmtNaira(r.avg_claim_amount)}</Td>
              <Td num>{fmtNaira(r.total_approved)}</Td>
              <Td><FlagBadge flagged={r.flagged} reason={r.flag_reason} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function AdmissionsView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.admissionRates, dateRange)
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Provider', 'State', 'Consultations', 'Admissions', 'Admission Rate %', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${flagRowClass(r.flagged)}`}>
              <Td bold>{r.provider_name}</Td>
              <Td>{r.state}</Td>
              <Td num>{fmt(r.consultations)}</Td>
              <Td num>{fmt(r.admissions)}</Td>
              <Td num>{fmt(r.admission_rate_pct, 1)}%</Td>
              <Td><FlagBadge flagged={r.flagged} reason={r.flag_reason} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function LabView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.labCostPerConsult, dateRange)
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Provider', 'State', 'Members', 'Consults', 'Lab Claims', 'Lab Cost (₦)', 'Lab Cost / Consult (₦)', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${flagRowClass(r.flagged)}`}>
              <Td bold>{r.provider_name}</Td>
              <Td>{r.state}</Td>
              <Td num>{fmt(r.unique_members)}</Td>
              <Td num>{fmt(r.consultation_count)}</Td>
              <Td num>{fmt(r.lab_claim_count)}</Td>
              <Td num>{fmtNaira(r.total_lab_cost)}</Td>
              <Td num>{fmtNaira(r.lab_cost_per_consult)}</Td>
              <Td><FlagBadge flagged={r.flagged} reason={r.flag_reason} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function DrugView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.drugCostPerConsult, dateRange)
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Provider', 'State', 'Members', 'Consults', 'Drug Lines', 'Drug Cost (₦)', 'Drug Cost / Consult (₦)', 'Status'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${flagRowClass(r.flagged)}`}>
              <Td bold>{r.provider_name}</Td>
              <Td>{r.state}</Td>
              <Td num>{fmt(r.unique_members)}</Td>
              <Td num>{fmt(r.consultation_count)}</Td>
              <Td num>{fmt(r.drug_line_count)}</Td>
              <Td num>{fmtNaira(r.total_drug_cost)}</Td>
              <Td num>{fmtNaira(r.drug_cost_per_consult)}</Td>
              <Td><FlagBadge flagged={r.flagged} reason={r.flag_reason} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

function EomView({ dateRange }: Props) {
  const { data, loading, error } = useFraudQuery(fraudApi.eomSpikes, dateRange)
  if (loading) return <div className="flex justify-center py-12"><LoadingSpinner /></div>
  if (error)   return <ErrorCard message={error} />
  if (!data?.length) return <Empty />
  return (
    <TableShell count={data.length}>
      <table className="w-full text-sm whitespace-nowrap">
        <thead className="bg-slate-50 border-b border-slate-200">
          <tr>{['Provider', 'State', 'Total Claims', 'EOM Claims', 'EOM Amount (₦)', 'EOM %', 'Risk'].map(h => <Th key={h}>{h}</Th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((r, i) => (
            <tr key={i} className={`hover:bg-slate-50 ${riskRowClass(r.risk_level)}`}>
              <Td bold>{r.provider_name}</Td>
              <Td>{r.state}</Td>
              <Td num>{fmt(r.total_claims)}</Td>
              <Td num>{fmt(r.eom_claims)}</Td>
              <Td num>{fmtNaira(r.eom_amount)}</Td>
              <Td num>{fmt(r.eom_claim_pct, 1)}%</Td>
              <Td><RiskBadge level={r.risk_level} /></Td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableShell>
  )
}

export function ProvidersTab({ dateRange }: Props) {
  const [view, setView] = useState<View>('cost')
  return (
    <div>
      <SubTabs active={view} onChange={setView} />
      {view === 'cost'       && <CostView       dateRange={dateRange} />}
      {view === 'admissions' && <AdmissionsView dateRange={dateRange} />}
      {view === 'lab'        && <LabView        dateRange={dateRange} />}
      {view === 'drug'       && <DrugView       dateRange={dateRange} />}
      {view === 'eom'        && <EomView        dateRange={dateRange} />}
    </div>
  )
}

// ── Shared primitives ─────────────────────────────────────────────────────────

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide">{children}</th>
}

function Td({ children, bold, num }: { children: React.ReactNode; bold?: boolean; num?: boolean }) {
  return (
    <td className={`px-4 py-2.5 max-w-[200px] truncate ${bold ? 'font-medium text-slate-800' : 'text-slate-600'} ${num ? 'tabular-nums' : ''}`}>
      {children}
    </td>
  )
}

function Empty() {
  return <div className="text-center py-12 text-slate-400 text-sm">No data found for this period.</div>
}
