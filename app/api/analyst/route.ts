import { NextResponse } from 'next/server'
import { runAnalystConversation } from '@/lib/analyst-agent'

export const maxDuration = 60

export async function POST(request: Request) {
  let body: { messages?: Array<{ role?: string; content?: string }> }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const messages = (body.messages ?? [])
    .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content!.slice(0, 4000) }))
    .slice(-12)

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return NextResponse.json({ error: 'Send a user message' }, { status: 400 })
  }

  try {
    const reply = await runAnalystConversation(messages)
    return NextResponse.json({ reply })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Analyst unavailable'
    const status = /not configured/i.test(message) ? 503 : 502
    return NextResponse.json({ error: message }, { status })
  }
}
