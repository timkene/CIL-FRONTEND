// ── Supabase table shapes ─────────────────────────────────────────────────────

export interface Staff {
  id:              number
  first_name:      string
  last_name:       string
  email:           string
  department:      string
  password?:       string   // only present at login, never included in list queries
  status:          'ACTIVE' | 'INACTIVE'
  session_version: number
  created_at:      string
  updated_at:      string
}

export interface DeptPermission {
  id:         number
  department: string
  modules:    string[]
}

export interface MLRSummary {
  id:                             number
  group_id:                       number
  group_name:                     string
  start_date:                     string
  end_date:                       string
  total_debit_amount:             number
  actual_claims_cost:             number
  unclaimed_pa_cost:              number
  total_actual_medical_cost:      number
  claims_paid_cost:               number
  actual_mlr:                     number
  actual_mlr_pct:                 string
  claims_paid_mlr:                number
  claims_paid_mlr_pct:            string
  mlr_status:                     MLRStatus
  enrolled_members:               number
  utilized_members:               number | null
  member_utilization_pct:         number | null
  contract_months:                number
  elapsed_months:                 number
  member_months:                  number
  actual_medical_cost_pmpm:       number
  claims_paid_medical_cost_pmpm:  number
  premium_pmpm:                   number
  computed_at:                    string
  had_error:                      boolean
  error_message:                  string | null
}

export interface LiveMLRSummary {
  id: number
  group_id: number
  contract_id: number
  group_name: string
  start_date: string
  end_date: string | null
  total_debit_amount: number
  actual_claims_cost: number
  unclaimed_pa_cost: number
  total_actual_medical_cost: number
  actual_mlr: number
  enrolled_members: number
  utilized_members: number
  member_utilization_pct: number
  fetched_at: string
  error: string | null
}

export interface TopProvider {
  rank:          number
  rank_by:       string
  summary_id:    number
  provider_id:   string | null
  provider_name: string | null
  visit_count:   number
  claim_rows:    number
  total_cost:    number
  pct_of_total:  number
}

export interface TopEnrollee {
  rank:          number
  rank_by:       string
  summary_id:    number
  enrollee_id:   string
  enrollee_name: string | null
  visit_count:   number
  claim_rows:    number
  total_cost:    number
  pct_of_total:  number
}

export interface TopProcedure {
  rank:           number
  rank_by:        string
  summary_id:     number
  procedure_code: string
  procedure_desc: string | null
  claim_count:    number
  total_cost:     number
  pct_of_total:   number
}

export interface RenewalReport {
  id:           number
  group_id:     number
  group_name:   string
  report_date:  string
  pdf_url:      string | null
  created_at:   string
}

export interface FraudScore {
  id:            number
  provider_id:   string
  provider_name: string | null
  fraud_score:   number
  risk_level:    string
  computed_at:   string
}

// ── Dashboard types ───────────────────────────────────────────────────────────

export interface KpiRow {
  id:                          number
  cash_collected_ytd:          number
  claims_paid_encounter_ytd:   number
  claims_paid_submitted_ytd:   number
  cash_collected_sply:         number
  claims_paid_encounter_sply:  number
  claims_paid_submitted_sply:  number
  mlr_encounter_pct:           number
  mlr_submitted_pct:           number
  ytd_from:                    string
  ytd_to:                      string
  sply_from:                   string
  sply_to:                     string
  current_year:                number
  last_year:                   number
}

export interface TrendRow {
  series:      string
  year:        number
  month:       number
  month_label: string
  value:       number
}

export interface ContractRow {
  id:                       number
  group_name:               string
  previous_contract_start:  string | null
  previous_contract_end:    string | null
  previous_debit:           number | null
  current_contract_start:   string
  current_contract_end:     string
  current_debit:            number | null
  cash_collected_current:   number
  cash_vs_debit_pct:        number | null
}

export interface Top20Row {
  id:            number
  category:      string
  rank:          number
  name:          string
  provider_id:   string | null
  provider_band: string | null
  amount_ytd:    number
}

export interface CashBreakRow {
  id:                    number
  year:                  number
  month:                 number
  month_label:           string
  total_cash:            number
  salary_palliative:     number
  expense:               number
  commission:            number
  salary_palliative_pct: number
  expense_pct:           number
  commission_pct:        number
  remaining:             number
  remaining_pct:         number
}

export interface PaymentScheduleRow {
  id:                 number
  group_id:           number
  group_name:         string
  payment_pattern:    string
  year:               number
  month:              number
  month_label:        string
  installment_num:    number
  total_installments: number
  expected_amount:    number | null
  invoice_status:     string
  invoice_number:     string | null
  is_renewal_advance: boolean
  contract_start:     string
  contract_end:       string
  cash_received:      number
}

// ── Business logic types ──────────────────────────────────────────────────────

export type MLRStatus = 'LOSS' | 'WARNING' | 'PROFITABLE'
export type MLRMode   = 'actual' | 'paid'

export interface ClientDetail {
  summary:         MLRSummary
  providersCost:   TopProvider[]
  providersCount:  TopProvider[]
  enrolleesCost:   TopEnrollee[]
  enrolleesCount:  TopEnrollee[]
  proceduresCost:  TopProcedure[]
  proceduresCount: TopProcedure[]
}
