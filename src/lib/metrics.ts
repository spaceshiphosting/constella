import type { MetricFrame } from './types'

// In-memory rolling metrics per edge for the last N seconds
type EdgeKey = string // `${sourceId}->${targetId}`

type EdgeStats = {
  sourceId: string
  targetId: string
  latenciesMs: number[]
  errors4xx: number
  errors5xx: number
  bytesOut: number
  samples: number
  lastTs: number
}

const edges = new Map<EdgeKey, EdgeStats>()

export function recordSample(params: {
  sourceId: string
  targetId: string
  latencyMs: number
  ok: boolean
  status?: number
  bytesOut?: number
}): void {
  const key = `${params.sourceId}->${params.targetId}`
  const now = Date.now()
  let e = edges.get(key)
  if (!e) {
    e = {
      sourceId: params.sourceId,
      targetId: params.targetId,
      latenciesMs: [],
      errors4xx: 0,
      errors5xx: 0,
      bytesOut: 0,
      samples: 0,
      lastTs: now,
    }
    edges.set(key, e)
  }
  e.latenciesMs.push(params.latencyMs)
  e.samples += 1
  e.bytesOut += params.bytesOut || 0
  if (params.status && params.status >= 400 && params.status < 500) e.errors4xx += 1
  if (params.status && params.status >= 500) e.errors5xx += 1
  e.lastTs = now
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

export function flushFrames(): MetricFrame[] {
  const now = Date.now()
  const frames: MetricFrame[] = []
  for (const e of edges.values()) {
    const arr = e.latenciesMs.slice().sort((a, b) => a - b)
    const rps = e.samples // per flush interval (assume 1s scheduler)
    const frame: MetricFrame = {
      ts: now,
      nodeId: e.sourceId,
      targetId: e.targetId,
      rps,
      p50: percentile(arr, 50),
      p95: percentile(arr, 95),
      p99: percentile(arr, 99),
      errors: { '4xx': e.errors4xx, '5xx': e.errors5xx },
      bytesOut: e.bytesOut,
      samples: e.samples,
    }
    frames.push(frame)
    // reset rolling window for next second
    e.latenciesMs = []
    e.errors4xx = 0
    e.errors5xx = 0
    e.bytesOut = 0
    e.samples = 0
  }
  return frames
}

// Simple SSE broadcaster registry
type Subscriber = {
  write: (data: string) => void
  close: () => void
}

const subscribers = new Set<Subscriber>()

export function subscribe(sub: Subscriber): () => void {
  subscribers.add(sub)
  return () => subscribers.delete(sub)
}

export function broadcast(frames: MetricFrame[]): void {
  if (subscribers.size === 0 || frames.length === 0) return
  const payload = JSON.stringify(frames)
  for (const s of subscribers) {
    try {
      s.write(`data: ${payload}\n\n`)
    } catch {
      // best-effort
    }
  }
}


