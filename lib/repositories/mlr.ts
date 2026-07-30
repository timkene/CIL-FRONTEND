import { supabase } from '@/lib/supabase'
import { TABLES } from '@/lib/constants'
import type { MLRSummary, TopProvider, TopEnrollee, TopProcedure, ClientDetail } from '@/lib/types'

export async function fetchMlrSummary(): Promise<MLRSummary[]> {
  const { data, error } = await supabase
    .from(TABLES.MLR_SUMMARY)
    .select('*')
    .eq('had_error', false)
    .order('actual_mlr', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchMlrSummaryForClients(): Promise<MLRSummary[]> {
  const { data, error } = await supabase
    .from(TABLES.MLR_SUMMARY)
    .select('*')
    .eq('had_error', false)
    .gt('total_debit_amount', 0)
    .order('group_name')

  if (error) throw new Error(error.message)
  return data ?? []
}

export async function fetchClientDetail(summary: MLRSummary): Promise<ClientDetail> {
  const [provRes, enrRes, procRes] = await Promise.all([
    supabase.from(TABLES.MLR_TOP_PROVIDERS).select('*').eq('summary_id', summary.id),
    supabase.from(TABLES.MLR_TOP_ENROLLEES).select('*').eq('summary_id', summary.id),
    supabase.from(TABLES.MLR_TOP_PROCEDURES).select('*').eq('summary_id', summary.id),
  ])

  if (provRes.error)  throw new Error(provRes.error.message)
  if (enrRes.error)   throw new Error(enrRes.error.message)
  if (procRes.error)  throw new Error(procRes.error.message)

  const byRank = (a: { rank: number }, b: { rank: number }) => a.rank - b.rank
  const providers  = (provRes.data  ?? []) as TopProvider[]
  const enrollees  = (enrRes.data   ?? []) as TopEnrollee[]
  const procedures = (procRes.data  ?? []) as TopProcedure[]

  return {
    summary,
    providersCost:   providers.filter(r => r.rank_by === 'cost').sort(byRank),
    providersCount:  providers.filter(r => r.rank_by === 'count').sort(byRank),
    enrolleesCost:   enrollees.filter(r => r.rank_by === 'cost').sort(byRank),
    enrolleesCount:  enrollees.filter(r => r.rank_by === 'count').sort(byRank),
    proceduresCost:  procedures.filter(r => r.rank_by === 'cost').sort(byRank),
    proceduresCount: procedures.filter(r => r.rank_by === 'count').sort(byRank),
  }
}
