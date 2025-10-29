import { createHmac, timingSafeEqual } from 'crypto'

export function requiredEnv(name: string): string {
  const v = process.env[name]
  if (!v) throw new Error(`Missing env: ${name}`)
  return v
}

export function signBody(body: string, ts: number, token: string): string {
  const h = createHmac('sha256', token)
  h.update(String(ts))
  h.update('\n')
  h.update(body)
  return Buffer.from(h.digest()).toString('base64')
}

export function verifyRequest(body: string, headers: Headers, token: string, maxSkewMs = 60_000): boolean {
  const provided = headers.get('x-constella-sign') || ''
  const tsStr = headers.get('x-constella-ts') || ''
  const ts = Number(tsStr)
  if (!provided || !Number.isFinite(ts)) return false
  if (Math.abs(Date.now() - ts) > maxSkewMs) return false
  const expected = signBody(body, ts, token)
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

