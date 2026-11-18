import { resolveAnalystLlm } from './analyst-llm'
import { ANALYST_TOOL_SPECS, runAnalystTool } from './analyst-tools'

const SYSTEM = `You are Clearline HMO's internal analyst assistant for logged-in staff.
Use tools for every number. Do not invent group IDs, lives, cash, debit, or medical cost.
Currency is Nigerian Naira. Dates are YYYY-MM-DD.
For plan-specific lives (bronze/silver), use group_plans, not active_lives member plan_id.
If a company name is ambiguous, list matches and ask which group_id.
Keep answers short and cite the group name, group_id, and date range.`

type ChatMessage = { role: 'user' | 'assistant'; content: string }

export async function runAnalystConversation(messages: ChatMessage[]): Promise<string> {
  const llm = resolveAnalystLlm()

  const openaiMessages: Array<Record<string, unknown>> = [
    { role: 'system', content: SYSTEM },
    ...messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  for (let round = 0; round < 6; round += 1) {
    const response = await fetch(llm.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${llm.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: llm.model,
        temperature: 0,
        messages: openaiMessages,
        tools: ANALYST_TOOL_SPECS,
      }),
      signal: AbortSignal.timeout(55_000),
    })
    if (!response.ok) {
      const err = await response.text()
      throw new Error(`LLM ${response.status}: ${err.slice(0, 200)}`)
    }
    const data = (await response.json()) as {
      choices: Array<{ message: { content?: string | null; tool_calls?: Array<{ id: string; function: { name: string; arguments: string } }> } }>
    }
    const message = data.choices[0]?.message
    if (!message) throw new Error('Empty LLM response')
    openaiMessages.push(message)

    const toolCalls = message.tool_calls ?? []
    if (toolCalls.length === 0) {
      return (message.content ?? '').trim() || 'I could not produce an answer.'
    }

    for (const call of toolCalls) {
      let args: Record<string, unknown> = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch {
        args = {}
      }
      let result: unknown
      try {
        result = await runAnalystTool(call.function.name, args)
      } catch (error) {
        result = { error: error instanceof Error ? error.message : 'tool failed' }
      }
      openaiMessages.push({
        role: 'tool',
        tool_call_id: call.id,
        content: JSON.stringify(result),
      })
    }
  }

  return 'I hit the tool-call limit. Ask again with a narrower question.'
}
