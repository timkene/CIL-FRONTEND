'use client'
import { useSupabaseQuery } from './useSupabaseQuery'
import { fetchMlrSummary, fetchMlrSummaryForClients } from '@/lib/repositories/mlr'
import type { LiveMLRPage, MLRSummary } from '@/lib/types'

async function fetchLiveMlr(limit: number, offset: number, search: string): Promise<LiveMLRPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search.trim()) query.set('search', search.trim())
  const response = await fetch(`/api/mlr?${query.toString()}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `MLR API returned HTTP ${response.status}`)
  return body
}

export function useMlrData(page = 0, pageSize = 50, search = '') {
  return useSupabaseQuery<LiveMLRPage>(() => fetchLiveMlr(pageSize, page * pageSize, search), [page, pageSize, search])
}

export function useMlrClients() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummaryForClients)
}
