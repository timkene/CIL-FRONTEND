import { supabase } from '@/lib/supabase'
import { TABLES } from '@/lib/constants'
import type { KpiRow, TrendRow, ContractRow, Top20Row, CashBreakRow, PaymentScheduleRow } from '@/lib/types'

export async function fetchDashboardKpi(): Promise<KpiRow | null> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_KPI_CARDS)
    .select('*')
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

export async function fetchDashboardTrends(): Promise<TrendRow[]> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_MONTHLY_TRENDS)
    .select('*')
    .order('year').order('month')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchDashboardContracts(): Promise<ContractRow[]> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_CONTRACT_SUMMARY)
    .select('*')
    .order('group_name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchDashboardTop20(): Promise<Top20Row[]> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_TOP20)
    .select('*')
    .order('category').order('rank')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchDashboardCashBreakdown(): Promise<CashBreakRow[]> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_CASH_BREAKDOWN)
    .select('*')
    .order('year').order('month')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchPaymentSchedule(): Promise<PaymentScheduleRow[]> {
  const { data, error } = await supabase
    .from(TABLES.DASHBOARD_PAYMENT_SCHEDULE)
    .select('*')
    .order('year').order('month').order('group_name')

  if (error) throw new Error(error.message)
  return data ?? []
}
