export type AnalystToolName =
  | 'search_companies'
  | 'medical_cost'
  | 'active_lives'
  | 'collections'
  | 'group_plans'

export const ANALYST_TOOL_SPECS = [
  {
    type: 'function' as const,
    function: {
      name: 'search_companies',
      description: 'Find HMO group accounts by company name. Use this first to get group_id.',
      parameters: {
        type: 'object',
        properties: {
          search: { type: 'string', description: 'Company or group name fragment' },
        },
        required: ['search'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'medical_cost',
      description: 'Medical cost for a group in a date range: approved claims plus unclaimed authorised PA. Amounts are Naira.',
      parameters: {
        type: 'object',
        properties: {
          group_id: { type: 'integer' },
          start_date: { type: 'string', description: 'YYYY-MM-DD' },
          end_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['group_id', 'start_date', 'end_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'active_lives',
      description: 'Total currently active enrollees for a group. Does not return member names.',
      parameters: {
        type: 'object',
        properties: { group_id: { type: 'integer' } },
        required: ['group_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'collections',
      description: 'Cash received plus debit notes for a company name and date range. Includes cash AccCode pairing when the office API supports it.',
      parameters: {
        type: 'object',
        properties: {
          company_name: { type: 'string' },
          from_date: { type: 'string', description: 'YYYY-MM-DD' },
          to_date: { type: 'string', description: 'YYYY-MM-DD' },
        },
        required: ['company_name', 'from_date', 'to_date'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'group_plans',
      description: 'Plan names and census lives on a group (use this for bronze/silver plan counts, not enrollee plan_id).',
      parameters: {
        type: 'object',
        properties: { group_id: { type: 'integer' } },
        required: ['group_id'],
      },
    },
  },
]

type MedicloudFn = (path: string, init?: RequestInit) => Promise<unknown>

function requireInt(value: unknown, field: string): number {
  const n = Number(value)
  if (!Number.isInteger(n) || n <= 0) throw new Error(`${field} must be a positive integer`)
  return n
}

function requireDate(value: unknown, field: string): string {
  const s = String(value ?? '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new Error(`${field} must be YYYY-MM-DD`)
  return s
}

function requireText(value: unknown, field: string): string {
  const s = String(value ?? '').trim()
  if (!s) throw new Error(`${field} is required`)
  return s
}

function slimRows<T>(rows: T[] | undefined, limit = 20): T[] {
  return Array.isArray(rows) ? rows.slice(0, limit) : []
}

export async function defaultMedicloud(path: string, init?: RequestInit): Promise<unknown> {
  const configured = (process.env.MEDICLOUD_API_URL ?? process.env.MLR_API_URL ?? 'https://api.clearlinehmo.com').replace(/\/+$/, '')
  const hostBase = configured.replace(/\/summary$/, '').replace(/\/mlr$/, '').replace(/\/api\/v1$/, '')
  const key = process.env.MEDICLOUD_API_KEY ?? ''
  if (!key) throw new Error('MediCloud API key is not configured')
  const response = await fetch(`${hostBase}${path}`, {
    cache: 'no-store',
    signal: AbortSignal.timeout(55_000),
    ...init,
    headers: {
      Accept: 'application/json',
      'X-API-Key': key,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  let body: unknown = text
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = { error: text.slice(0, 400) }
  }
  if (!response.ok) {
    throw new Error(`MediCloud ${response.status} on ${path}`)
  }
  return body
}

export async function runAnalystTool(
  name: string,
  args: Record<string, unknown>,
  deps: { medicloud?: MedicloudFn } = {},
): Promise<unknown> {
  const medicloud = deps.medicloud ?? defaultMedicloud

  if (name === 'search_companies') {
    const search = encodeURIComponent(requireText(args.search, 'search'))
    const data = (await medicloud(`/groups?search=${search}&limit=20&offset=0`)) as {
      total?: number
      results?: Array<{ group_id: number; group_name: string }>
    }
    return {
      total: data.total ?? 0,
      results: slimRows(data.results).map((row) => ({
        group_id: row.group_id,
        group_name: row.group_name,
      })),
    }
  }

  if (name === 'medical_cost') {
    const group_id = requireInt(args.group_id, 'group_id')
    const start_date = requireDate(args.start_date, 'start_date')
    const end_date = requireDate(args.end_date, 'end_date')
    const data = (await medicloud('/client-utilization', {
      method: 'POST',
      body: JSON.stringify({ group_id, start_date, end_date }),
    })) as { summary?: unknown }
    return { group_id, start_date, end_date, summary: data.summary ?? data }
  }

  if (name === 'active_lives') {
    const group_id = requireInt(args.group_id, 'group_id')
    const data = (await medicloud(`/enrollees/active?group_id=${group_id}&limit=1&offset=0`)) as {
      group?: unknown
      total?: number
    }
    return { group: data.group, total: data.total ?? 0 }
  }

  if (name === 'collections') {
    const company_name = encodeURIComponent(requireText(args.company_name, 'company_name'))
    const from_date = requireDate(args.from_date, 'from_date')
    const to_date = requireDate(args.to_date, 'to_date')
    const data = (await medicloud(
      `/collections?company_name=${company_name}&from_date=${from_date}&to_date=${to_date}`,
    )) as Record<string, unknown>
    const cash = (data.cash_received as { items?: unknown[] } | undefined)?.items
    const debit = (data.debit_notes as { items?: unknown[] } | undefined)?.items
    return {
      query: data.query,
      cash_received: {
        ...(typeof data.cash_received === 'object' && data.cash_received ? data.cash_received : {}),
        items: slimRows(cash),
      },
      debit_notes: {
        ...(typeof data.debit_notes === 'object' && data.debit_notes ? data.debit_notes : {}),
        items: slimRows(debit),
      },
    }
  }

  if (name === 'group_plans') {
    const group_id = requireInt(args.group_id, 'group_id')
    const data = (await medicloud(`/group-plans?group_id=${group_id}&active_only=true&limit=500&offset=0`)) as {
      total?: number
      results?: Array<Record<string, unknown>>
    }
    return {
      total: data.total ?? 0,
      results: slimRows(data.results, 50).map((row) => ({
        plan_id: row.plan_id,
        plan_name: row.plan_name,
        start_date: row.start_date,
        end_date: row.end_date,
        enrollee_count: row.enrollee_count,
        principal_count: row.principal_count,
        dependant_count: row.dependant_count,
      })),
    }
  }

  throw new Error(`Unknown tool: ${name}`)
}
