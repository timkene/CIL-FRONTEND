import { useEffect, useState } from 'react'

const BASE = process.env.NEXT_PUBLIC_FRAUD_API_URL ?? 'http://localhost:8004'

export interface DateRange {
  start: string
  end: string
}

// ── Response types ────────────────────────────────────────────────────────────

export interface FraudSummary {
  total_claims: number
  unique_members: number
  unique_providers: number
  total_approved: number
  avg_claim_amount: number
  zero_amount_claims: number
  weekend_claims: number
  weekend_claim_pct: number
}

export interface ProviderCostRow {
  provider_id: number | null
  provider_name: string
  state: string
  unique_members: number
  total_claims: number
  total_approved: number
  cost_per_member: number
  avg_claim_amount: number
  flagged: boolean
  flag_reason: string
}

export interface TopCostMemberRow {
  enrollee_id: string
  member_name: string
  gender: string
  employer: string | null
  total_claims: number
  providers_visited: number
  distinct_diagnoses: number
  total_approved: number
  avg_claim_amount: number
  flagged: boolean
  flag_reason: string
}

export interface AdmissionRateRow {
  provider_id: number | null
  provider_name: string
  state: string
  total_claims: number
  unique_members: number
  admissions: number
  consultations: number
  admission_rate_pct: number | null
  flagged: boolean
  flag_reason: string
}

export interface LabCostRow {
  provider_id: number | null
  provider_name: string
  state: string
  unique_members: number
  total_lab_cost: number
  lab_claim_count: number
  consultation_count: number
  lab_cost_per_consult: number | null
  flagged: boolean
  flag_reason: string
}

export interface DrugCostRow {
  provider_id: number | null
  provider_name: string
  state: string
  unique_members: number
  total_drug_cost: number
  drug_line_count: number
  consultation_count: number
  drug_cost_per_consult: number | null
  flagged: boolean
  flag_reason: string
}

export interface ProviderShoppingRow {
  enrollee_id: string
  member_name: string
  gender: string
  employer: string | null
  diagnosiscode: string
  provider_count: number
  claim_count: number
  total_cost: number
  first_visit: string
  last_visit: string
}

export interface DuplicateClaimRow {
  enrollee_id: string
  member_name: string
  provider_id: number | null
  provider_name: string
  diagnosiscode: string
  procedurecode: string
  service_date: string
  approved_amount: number
  duplicate_count: number
  total_overpaid: number
  potential_recovery: number
}

export interface DuplicateClaimsResponse {
  total_duplicate_groups: number
  total_potential_recovery: number
  records: DuplicateClaimRow[]
}

export interface CollusionRiskRow {
  enrollee_id: string
  member_name: string
  gender: string
  employer: string | null
  provider_id: number | null
  provider_name: string
  member_total_cost: number
  cost_at_provider: number
  loyalty_pct: number
  claims_at_provider: number
  member_total_claims: number
  visit_days_at_provider: number
  avg_days_between_visits: number | null
  collusion_risk_score: number
}

export interface ExcessiveUtilizationRow {
  enrollee_id: string
  member_name: string
  gender: string
  employer: string | null
  avg_visits_per_month: number
  peak_month_visits: number
  total_visits: number
  months_active: number
  network_avg_visits_per_month: number
  utilization_ratio: number
  risk_level: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'NORMAL'
}

export interface IdentityLendingRow {
  enrollee_id: string
  member_name: string
  gender: string
  procedurecode: string
  diagnosiscode: string
  service_date: string
  provider_name: string
  approved_amount: number
  mismatch_type: string
}

export interface DrugRefillAbuseRow {
  enrollee_id: string
  member_name: string
  gender: string
  drug_code: string
  refill_count: number
  avg_days_between_refills: number
  shortest_refill_gap: number
  total_drug_cost: number
  early_refills: number
  risk_level: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'MONITOR'
}

export interface EomSpikeRow {
  provider_id: number | null
  provider_name: string
  state: string
  total_claims: number
  eom_claims: number
  eom_amount: number
  eom_claim_pct: number
  risk_level: 'CRITICAL' | 'HIGH' | 'ELEVATED' | 'NORMAL'
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const url = new URL(`${BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Fraud API ${res.status}: ${path}`)
  return res.json()
}

function rangeParams(range: DateRange) {
  return { start: range.start || undefined, end: range.end || undefined }
}

// ── API functions ─────────────────────────────────────────────────────────────

export const fraudApi = {
  summary:              (r: DateRange) => get<FraudSummary>('/fraud/summary', rangeParams(r)),
  providerCostPerMember:(r: DateRange) => get<ProviderCostRow[]>('/fraud/provider-cost-per-member', { ...rangeParams(r), limit: 50 }),
  topCostMembers:       (r: DateRange) => get<TopCostMemberRow[]>('/fraud/top-cost-members', { ...rangeParams(r), limit: 50 }),
  admissionRates:       (r: DateRange) => get<AdmissionRateRow[]>('/fraud/admission-rates', rangeParams(r)),
  labCostPerConsult:    (r: DateRange) => get<LabCostRow[]>('/fraud/lab-cost-per-consult', rangeParams(r)),
  drugCostPerConsult:   (r: DateRange) => get<DrugCostRow[]>('/fraud/drug-cost-per-consult', rangeParams(r)),
  providerShopping:     (r: DateRange) => get<ProviderShoppingRow[]>('/fraud/provider-shopping', rangeParams(r)),
  duplicateClaims:      (r: DateRange) => get<DuplicateClaimsResponse>('/fraud/duplicate-claims', rangeParams(r)),
  collusionRisk:        (r: DateRange) => get<CollusionRiskRow[]>('/fraud/collusion-risk', rangeParams(r)),
  excessiveUtilization: (r: DateRange) => get<ExcessiveUtilizationRow[]>('/fraud/excessive-utilization', rangeParams(r)),
  identityLending:      (r: DateRange) => get<IdentityLendingRow[]>('/fraud/identity-lending', rangeParams(r)),
  drugRefillAbuse:      (r: DateRange) => get<DrugRefillAbuseRow[]>('/fraud/drug-refill-abuse', rangeParams(r)),
  eomSpikes:            (r: DateRange) => get<EomSpikeRow[]>('/fraud/eom-spikes', rangeParams(r)),
}

// ── useFraudQuery hook ────────────────────────────────────────────────────────

export function useFraudQuery<T>(
  fn: (range: DateRange) => Promise<T>,
  range: DateRange
): { data: T | null; loading: boolean; error: string | null } {
  const [data,    setData]    = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fn(range)
      .then(d  => { if (!cancelled) { setData(d);          setLoading(false) } })
      .catch(e => { if (!cancelled) { setError(e.message); setLoading(false) } })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end])

  return { data, loading, error }
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null) return '—'
  return n.toLocaleString('en-NG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

export function fmtNaira(n: number | null | undefined): string {
  if (n == null) return '—'
  return `₦${fmt(n)}`
}
