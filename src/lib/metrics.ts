import type { MetricFrame } from './types'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

// In-memory rolling metrics per edge for the last 1 hour
type EdgeKey = string // `${sourceId}->${targetId}`

type LatencySample = {
  latencyMs: number
  timestamp: number
}

type EdgeStats = {
  sourceId: string
  targetId: string
  latenciesMs: number[]
  latencySamples: LatencySample[] // Store actual samples with timestamps
  errors4xx: number
  errors5xx: number
  bytesOut: number
  samples: number
  lastTs: number
}

type ActiveConnection = {
  nodeId: string
  targetId: string
  lastSeen: number
}

type PersistedData = {
  edges: Record<EdgeKey, EdgeStats>
  activeConnections: Record<string, ActiveConnection>
  lastSaved: number
}

const edges = new Map<EdgeKey, EdgeStats>()
const activeConnections = new Map<string, ActiveConnection>()

// Persistence file path
const PERSISTENCE_FILE = join(process.cwd(), '.constella-metrics.json')

// Load persisted data on startup
function loadPersistedData(): void {
  try {
    if (existsSync(PERSISTENCE_FILE)) {
      const data = JSON.parse(readFileSync(PERSISTENCE_FILE, 'utf8')) as PersistedData
      const oneHourAgo = Date.now() - ONE_HOUR
      
      // Only load data from the last hour
      for (const [key, edgeStats] of Object.entries(data.edges)) {
        if (edgeStats.lastTs > oneHourAgo) {
          // Ensure latencySamples exists (for backward compatibility)
          if (!edgeStats.latencySamples) {
            edgeStats.latencySamples = []
          }
          edges.set(key, edgeStats)
        }
      }
      
      for (const [key, conn] of Object.entries(data.activeConnections)) {
        if (conn.lastSeen > oneHourAgo) {
          activeConnections.set(key, conn)
        }
      }
    }
  } catch (error) {
    console.warn('Failed to load persisted metrics:', error)
  }
}

// Save data to disk
function savePersistedData(): void {
  try {
    const data: PersistedData = {
      edges: Object.fromEntries(edges),
      activeConnections: Object.fromEntries(activeConnections),
      lastSaved: Date.now()
    }
    writeFileSync(PERSISTENCE_FILE, JSON.stringify(data, null, 2))
  } catch (error) {
    console.warn('Failed to save metrics:', error)
  }
}

// 1 hour in milliseconds
const ONE_HOUR = 60 * 60 * 1000
const INACTIVE_THRESHOLD = 5 * 60 * 1000 // 5 minutes

// Load data on module initialization
loadPersistedData()

// Save data every 30 seconds
setInterval(savePersistedData, 30000)

// Clean up old data every 5 minutes to respect 1-hour window
setInterval(() => {
  const now = Date.now()
  const oneHourAgo = now - ONE_HOUR
  
  // Clean up old latency samples from all edges
  for (const [key, e] of edges.entries()) {
    e.latencySamples = e.latencySamples.filter(sample => sample.timestamp > oneHourAgo)
    e.latenciesMs = e.latencySamples.map(s => s.latencyMs)
    
    // Remove edges with no recent data
    if (e.latencySamples.length === 0 && now - e.lastTs > ONE_HOUR) {
      edges.delete(key)
      activeConnections.delete(key)
    }
  }
}, 5 * 60 * 1000) // Every 5 minutes

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
  
  // Update active connections
  activeConnections.set(key, {
    nodeId: params.sourceId,
    targetId: params.targetId,
    lastSeen: now
  })
  
  let e = edges.get(key)
  if (!e) {
    e = {
      sourceId: params.sourceId,
      targetId: params.targetId,
      latenciesMs: [],
      latencySamples: [],
      errors4xx: 0,
      errors5xx: 0,
      bytesOut: 0,
      samples: 0,
      lastTs: now,
    }
    edges.set(key, e)
  }
  
  // Add to rolling window (1 hour)
  e.latencySamples.push({ latencyMs: params.latencyMs, timestamp: now })
  e.samples += 1
  e.bytesOut += params.bytesOut || 0
  if (params.status && params.status >= 400 && params.status < 500) e.errors4xx += 1
  if (params.status && params.status >= 500) e.errors5xx += 1
  e.lastTs = now
  
  // Keep only recent latency samples (limit to last 1 hour)
  const oneHourAgo = now - ONE_HOUR
  e.latencySamples = e.latencySamples.filter(sample => sample.timestamp > oneHourAgo)
  
  // Update latenciesMs array from filtered samples
  e.latenciesMs = e.latencySamples.map(s => s.latencyMs)
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)))
  return sorted[idx]
}

export function flushFrames(): MetricFrame[] {
  const now = Date.now()
  const frames: MetricFrame[] = []
  const oneHourAgo = now - ONE_HOUR
  
  // Clean up inactive connections
  for (const [key, conn] of activeConnections.entries()) {
    if (now - conn.lastSeen > INACTIVE_THRESHOLD) {
      activeConnections.delete(key)
      edges.delete(key)
    }
  }
  
  // Only process active connections
  for (const [key, e] of edges.entries()) {
    const conn = activeConnections.get(key)
    if (!conn || now - conn.lastSeen > INACTIVE_THRESHOLD) {
      continue // Skip inactive connections
    }
    
    // Clean up old latency samples to respect 1-hour window
    e.latencySamples = e.latencySamples.filter(sample => sample.timestamp > oneHourAgo)
    
    // Update latenciesMs array from filtered samples for percentile calculations
    e.latenciesMs = e.latencySamples.map(s => s.latencyMs)
    
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
    
    // Reset counters for next second
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

export function getActiveConnections(): ActiveConnection[] {
  const now = Date.now()
  const active: ActiveConnection[] = []
  
  for (const [key, conn] of activeConnections.entries()) {
    if (now - conn.lastSeen <= INACTIVE_THRESHOLD) {
      active.push(conn)
    }
  }
  
  return active
}

// Get current metrics data for immediate UI loading - only real data points
export function getCurrentMetricsData(): Record<string, { ts: number; rps: number; p95: number }[]> {
  const now = Date.now()
  const oneHourAgo = now - ONE_HOUR
  const result: Record<string, { ts: number; rps: number; p95: number }[]> = {}
  
  for (const [key, e] of edges.entries()) {
    const conn = activeConnections.get(key)
    if (!conn || now - conn.lastSeen > INACTIVE_THRESHOLD) {
      continue // Skip inactive connections
    }
    
    // Only use real samples with timestamps
    const recentSamples = e.latencySamples.filter(sample => sample.timestamp > oneHourAgo)
    if (recentSamples.length === 0) continue
    
    // Group samples by second to calculate RPS and p95 per second
    const samplesBySecond = new Map<number, number[]>()
    
    for (const sample of recentSamples) {
      const second = Math.floor(sample.timestamp / 1000) * 1000 // Round to second
      if (!samplesBySecond.has(second)) {
        samplesBySecond.set(second, [])
      }
      samplesBySecond.get(second)!.push(sample.latencyMs)
    }
    
    // Create data points for each second that has data
    const dataPoints: { ts: number; rps: number; p95: number }[] = []
    
    for (const [timestamp, latencies] of samplesBySecond.entries()) {
      const sortedLatencies = latencies.slice().sort((a, b) => a - b)
      const p95 = percentile(sortedLatencies, 95)
      
      dataPoints.push({
        ts: timestamp,
        rps: latencies.length, // Actual RPS (samples per second)
        p95: Math.round(p95)
      })
    }
    
    // Sort by timestamp
    dataPoints.sort((a, b) => a.ts - b.ts)
    
    if (dataPoints.length > 0) {
      result[key] = dataPoints
    }
  }
  
  return result
}


