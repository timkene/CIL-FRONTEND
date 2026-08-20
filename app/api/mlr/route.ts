import { NextResponse } from 'next/server'

const MEDICLOUD_BASE = (process.env.MEDICLOUD_API_URL ?? 'https://api.clearlinehmo.com').replace(/\/$/, '')
const MEDICLOUD_API_KEY = process.env.MEDICLOUD_API_KEY ?? ''
const REQUEST_TIMEOUT_MS = 25_000

// The live aggregation fans out across active contracts. Pro/Enterprise
// Vercel plans can honor this duration; lower plans should use the eventual
// cached/composite API before enabling the page in production.
export const maxDuration = 60

type Group = {
  group_id: number
  group_name: string
  status_code_id?: number | null
  termination_date?: string | null
  contracts?: Array<{
    contract_id: number
    start_date?: string | null
    end_date?: string | null
    renewal_date?: string | null
    is_current?: boolean
    contract_sum?: number | null
  }>
}

type GroupResponse = { results?: Group[]; truncated?: boolean; total?: number }

async function medicloud<T>(path: string, init?: RequestInit): Promise<T> {
  if (!MEDICLOUD_API_KEY) throw new Error('MediCloud API key is not configured')
  const response = await fetch(`${MEDICLOUD_BASE}${path}`, {
    ...init,
    cache: 'no-store',
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: {
      Accept: 'application/json',
      'X-API-Key': MEDICLOUD_API_KEY,
      ...(init?.headers ?? {}),
    },
  })
  if (!response.ok) throw new Error(`MediCloud ${response.status} for ${path}`)
  return response.json() as Promise<T>
}

function isActiveContract(contract: NonNullable<Group['contracts']>[number], today: string) {
  return Boolean(
    contract.start_date &&
    contract.start_date <= today &&
    (!contract.end_date || contract.end_date >= today)
  )
}

async function mapConcurrent<T, R>(items: T[], worker: (item: T) => Promise<R>, concurrency: number) {
  const results: R[] = []
  let next = 0
  async function consume() {
    while (next < items.length) {
      const item = items[next++]
      results.push(await worker(item))
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, consume))
  return results
}

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10)
    const groups = await medicloud<GroupResponse>('/groups?active_only=true&limit=5000')
    const activeContracts = (groups.results ?? []).flatMap(group =>
      (group.contracts ?? [])
        .filter(contract => isActiveContract(contract, today))
        .map(contract => ({ group, contract }))
    )

    const data = await mapConcurrent(activeContracts, async ({ group, contract }) => {
      try {
        const query = `group_id=${group.group_id}&contract_id=${contract.contract_id}`
        const [utilization, debit, lives] = await Promise.all([
          medicloud<{ summary: { claims_cost: number; unclaimed_pa_cost: number; total_medical_cost: number; members_utilized: number } }>(
            '/client-utilization/by-contract',
            { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ group_id: group.group_id, contract_id: contract.contract_id }) }
          ),
          medicloud<{ total_amount: number }>(`/debit-notes/by-contract?${query}`),
          medicloud<{ total: number }>(`/enrollees/active?group_id=${group.group_id}&limit=1`),
        ])
        const debitAmount = Number(debit.total_amount ?? 0)
        const medicalCost = Number(utilization.summary.total_medical_cost ?? 0)
        const activeLives = Number(lives.total ?? 0)
        return {
          id: contract.contract_id,
          group_id: group.group_id,
          contract_id: contract.contract_id,
          group_name: group.group_name,
          start_date: contract.start_date,
          end_date: contract.end_date,
          total_debit_amount: debitAmount,
          actual_claims_cost: Number(utilization.summary.claims_cost ?? 0),
          unclaimed_pa_cost: Number(utilization.summary.unclaimed_pa_cost ?? 0),
          total_actual_medical_cost: medicalCost,
          actual_mlr: debitAmount > 0 ? medicalCost / debitAmount : 0,
          enrolled_members: activeLives,
          utilized_members: Number(utilization.summary.members_utilized ?? 0),
          member_utilization_pct: activeLives > 0 ? Number(utilization.summary.members_utilized ?? 0) / activeLives * 100 : 0,
          fetched_at: new Date().toISOString(),
          error: null,
        }
      } catch (error) {
        return {
          id: contract.contract_id,
          group_id: group.group_id,
          contract_id: contract.contract_id,
          group_name: group.group_name,
          start_date: contract.start_date,
          end_date: contract.end_date,
          total_debit_amount: 0,
          actual_claims_cost: 0,
          unclaimed_pa_cost: 0,
          total_actual_medical_cost: 0,
          actual_mlr: 0,
          enrolled_members: 0,
          utilized_members: 0,
          member_utilization_pct: 0,
          fetched_at: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Failed to load client metrics',
        }
      }
    }, 24)

    return NextResponse.json({ data, source: 'medicloud-live', fetched_at: new Date().toISOString() })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'MLR data unavailable'
    const status = message.includes('API key') ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
