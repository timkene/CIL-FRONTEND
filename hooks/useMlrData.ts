'use client'
import { useSupabaseQuery } from './useSupabaseQuery'
import { fetchMlrSummary, fetchMlrSummaryForClients } from '@/lib/repositories/mlr'
import type { LiveMLRPage, MLRSummary } from '@/lib/types'

async function fetchLiveMlr(limit: number, offset: number): Promise<LiveMLRPage> {
  const response = await fetch(`/api/mlr?limit=${limit}&offset=${offset}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `MLR API returned HTTP ${response.status}`)
  return body
}

export function useMlrData(page = 0, pageSize = 50) {
  return useSupabaseQuery<LiveMLRPage>(() => fetchLiveMlr(pageSize, page * pageSize), [page, pageSize])
}

export function useMlrClients() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummaryForClients)
}
