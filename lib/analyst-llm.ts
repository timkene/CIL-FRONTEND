const GATEWAY_CHAT_URL = 'https://ai-gateway.vercel.sh/v1/chat/completions'
const DEFAULT_MODEL = 'openai/gpt-4.1-mini'

export function resolveAnalystLlm(env: NodeJS.ProcessEnv = process.env): {
  url: string
  apiKey: string
  model: string
} {
  const apiKey = env.AI_GATEWAY_API_KEY || env.VERCEL_OIDC_TOKEN || ''
  if (!apiKey) {
    throw new Error('AI Gateway is not configured (set AI_GATEWAY_API_KEY, or deploy on Vercel for OIDC)')
  }
  const model = (env.ANALYST_MODEL || DEFAULT_MODEL).trim()
  return { url: GATEWAY_CHAT_URL, apiKey, model }
}
