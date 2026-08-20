'use client'
import { useSupabaseQuery } from './useSupabaseQuery'
import { fetchMlrSummary, fetchMlrSummaryForClients } from '@/lib/repositories/mlr'
import type { MLRSummary } from '@/lib/types'

export function useMlrData() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummary)
}

export function useMlrClients() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummaryForClients)
}
