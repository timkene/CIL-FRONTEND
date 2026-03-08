import { createClient } from '@supabase/supabase-js'

const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(url, anon)

export interface Staff {
  id:              number
  first_name:      string
  last_name:       string
  email:           string
  department:      string
  password:        string
  status:          'ACTIVE' | 'INACTIVE'
  session_version: number
  created_at:      string
  updated_at:      string
}

export interface DeptPermission {
  id:         number
  department: string
  modules:    string[]   // ['ALL'] or ['MLR Data', 'Premium Analysis', ...]
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
  mlr_status:                     string
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
