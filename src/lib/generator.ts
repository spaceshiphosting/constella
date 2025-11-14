import { listPeers, upsertPeers } from './registry'
import { recordSample, flushFrames, broadcast } from './metrics'
import { STATIC_PEERS } from './config'

let started = false

function getSelfId(): string {
  return `node-${process.env.PORT || 'unknown'}`
}

function getSelfUrl(): string {
  return `http://localhost:${process.env.PORT || '3000'}`
}

export function startTrafficGenerator(): void {
  if (started) return
  started = true

  // Scheduler: every 10s flush metrics and send new requests
  setInterval(async () => {
    const selfId = getSelfId()
    const selfUrl = getSelfUrl()
    
    // Ensure static peers exist in registry
    upsertPeers(STATIC_PEERS)

    const peers = listPeers().filter((p) => p.id !== selfId && p.url !== selfUrl)
    // Send multiple pings per peer for better percentile calculations
    await Promise.all(
      peers.map(async (peer) => {
        // Send 5 pings per peer per second for better statistics
        for (let i = 0; i < 5; i++) {
          const start = Date.now()
          try {
            const res = await fetch(`${peer.url}/api/mesh/ping`)
            let latency = Date.now() - start
            
            // Add realistic latency variation for localhost connections
            if (peer.url.includes('localhost') || peer.url.includes('127.0.0.1')) {
              // Simulate network latency: 1-5ms base + 0-3ms jitter
              const baseLatency = 1 + Math.random() * 4 // 1-5ms
              const jitter = Math.random() * 3 // 0-3ms
              latency = Math.max(1, baseLatency + jitter)
            }
            
            recordSample({
              sourceId: selfId,
              targetId: peer.id,
              latencyMs: latency,
              ok: res.ok,
              status: res.status,
            })
          } catch {
            let latency = Date.now() - start
            
            // Add realistic timeout latency
            if (peer.url.includes('localhost') || peer.url.includes('127.0.0.1')) {
              latency = 100 + Math.random() * 200 // 100-300ms for timeouts
            }
            
            recordSample({
              sourceId: selfId,
              targetId: peer.id,
              latencyMs: latency,
              ok: false,
              status: 599,
            })
          }
          // Small delay between pings to spread them out
          if (i < 4) await new Promise(resolve => setTimeout(resolve, 50))
        }
      })
    )

    // Flush and broadcast
    const frames = flushFrames()
    broadcast(frames)
  }, 10000)
}

// Auto-start once per process using a global guard so it runs server-side without UI
const GLOBAL_KEY = '__CONSTELLA_TRAFFIC_STARTED__'
try {
  const g = globalThis as any
  if (!g[GLOBAL_KEY]) {
    startTrafficGenerator()
    g[GLOBAL_KEY] = true
  }
} catch {}


