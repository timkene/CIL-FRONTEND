import { createHash, createHmac, randomUUID } from 'node:crypto'

export const CLAIMS_AUDIENCE = 'nhia-claims-mutation-v1'

export function validClaimsOrigin(origin: string | null, host: string | null,
                                  site: string | null): boolean {
  if (!origin || !host || (site && site !== 'same-origin')) return false
  try {
    const parsed = new URL(origin)
    return parsed.host === host && (parsed.protocol === 'https:' ||
      (parsed.protocol === 'http:' && (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1')))
  } catch { return false }
}

export function signClaimsMutation(operatorId: string, token: string, action: string,
                                   key: string, body: string, now = Math.floor(Date.now() / 1000),
                                   jti = randomUUID()): string {
  const payload = {
    sub: operatorId, sid: createHash('sha256').update(token).digest('hex'),
    action, aud: CLAIMS_AUDIENCE, body_sha256: createHash('sha256').update(body).digest('hex'),
    iat: now, exp: now + 30, jti,
  }
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return `${encoded}.${createHmac('sha256', key).update(encoded).digest('hex')}`
}
