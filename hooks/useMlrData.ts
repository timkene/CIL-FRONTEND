'use client'
import { useSupabaseQuery } from './useSupabaseQuery'
import { fetchMlrSummary, fetchMlrSummaryForClients } from '@/lib/repositories/mlr'
import type { LiveMLRSummary, MLRSummary } from '@/lib/types'

async function fetchLiveMlr(): Promise<LiveMLRSummary[]> {
  const response = await fetch('/api/mlr', { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `MLR API returned HTTP ${response.status}`)
  return body.data ?? []
}

export function useMlrData() {
  return useSupabaseQuery<LiveMLRSummary[]>(fetchLiveMlr)
}

export function useMlrClients() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummaryForClients)
}
