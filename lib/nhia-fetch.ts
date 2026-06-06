import { getSession } from '@/lib/auth'

export async function nhiaFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const session = getSession()
  const sessionHeaders: Record<string, string> = session
    ? {
        'X-Staff-Id':   String(session.id),
        'X-Staff-Name': `${session.first_name} ${session.last_name}`.trim(),
      }
    : {}

  return fetch(url, {
    ...options,
    headers: {
      ...sessionHeaders,
      ...(options.headers as Record<string, string> | undefined),
    },
  })
}
