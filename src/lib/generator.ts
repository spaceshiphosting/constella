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

  // Scheduler: every 1s flush metrics and send new requests
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
            const latency = Date.now() - start
            recordSample({
              sourceId: selfId,
              targetId: peer.id,
              latencyMs: latency,
              ok: res.ok,
              status: res.status,
            })
          } catch {
            const latency = Date.now() - start
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
  }, 1000)
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


