'use client'
import { useSupabaseQuery } from './useSupabaseQuery'
import { fetchMlrSummary, fetchMlrSummaryForClients } from '@/lib/repositories/mlr'
import type { LiveMLRPage, LiveMLRSummary, MLRSummary } from '@/lib/types'

async function fetchLiveMlr(limit: number, offset: number, search: string): Promise<LiveMLRPage> {
  const query = new URLSearchParams({ limit: String(limit), offset: String(offset) })
  if (search.trim()) query.set('search', search.trim())
  const response = await fetch(`/api/mlr?${query.toString()}`, { cache: 'no-store' })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error ?? `MLR API returned HTTP ${response.status}`)
  return body
}

async function fetchAllLiveMlr(pageSize: number, search: string): Promise<LiveMLRPage> {
  const all: LiveMLRSummary[] = []
  let offset = 0
  let first: LiveMLRPage | null = null
  while (true) {
    const page = await fetchLiveMlr(pageSize, offset, search)
    first ??= page
    all.push(...page.data)
    if (!page.has_more || page.data.length === 0) break
    offset += page.limit
  }
  return { ...(first ?? { active_contracts: 0, total_active_contracts: 0, offset: 0, limit: pageSize, has_more: false, failed_contracts: 0, source: 'medicloud-live', fetched_at: new Date().toISOString() }), data: all, offset: 0, limit: pageSize, has_more: false, total_active_contracts: all.length }
}

export function useMlrData(page = 0, pageSize = 50, search = '', loadAll = false) {
  return useSupabaseQuery<LiveMLRPage>(() => loadAll ? fetchAllLiveMlr(pageSize, search) : fetchLiveMlr(pageSize, page * pageSize, search), [page, pageSize, search, loadAll])
}

export function useMlrClients() {
  return useSupabaseQuery<MLRSummary[]>(fetchMlrSummaryForClients)
}
