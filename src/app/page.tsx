"use client"
import { useEffect, useMemo, useState } from 'react'

type Peer = { id: string; name: string; url: string; region?: string; provider?: string; addedAt: string; version: string }

export default function HomePage() {
  const [peers, setPeers] = useState<Peer[]>([])
  const [form, setForm] = useState({ url: '' })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [framesByEdge, setFramesByEdge] = useState<Record<string, { ts: number; rps: number; p95: number }[]>>({})

  const selfDefaults = useMemo(() => ({
    name: process.env.NODE_NAME || 'Local-Node',
  }), [])

  useEffect(() => {
    fetch('/api/mesh/peers')
      .then((r) => r.json())
      .then((d) => setPeers(d.peers || []))
      .catch(() => {})
  }, [])

  // Auto-connect to SSE on load
  useEffect(() => {
    const es = new EventSource('/api/metrics/stream')
    const oneHourAgo = Date.now() - (60 * 60 * 1000) // 1 hour ago
    
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as { ts: number; nodeId: string; targetId: string; rps: number; p95: number }[]
        setFramesByEdge((prev) => {
          const copy = { ...prev }
          for (const f of parsed) {
            const key = `${f.nodeId}->${f.targetId}`
            const arr = copy[key] || []
            arr.push({ ts: f.ts, rps: f.rps, p95: f.p95 })
            
            // Keep only data from the last hour (3600 samples at 1s intervals)
            const filtered = arr.filter(sample => sample.ts > oneHourAgo)
            copy[key] = filtered
          }
          return copy
        })
      } catch {}
    }
    es.onerror = () => {
      // Best-effort reconnect handled by browser
    }
    return () => es.close()
  }, [])

  async function upsertPeer() {
    setError(null)
    setSubmitting(true)
    try {
      const body = JSON.stringify({ url: form.url })
      const res = await fetch('/api/mesh/peers/add', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      if (!res.ok) throw new Error(`Upsert failed: ${res.status}`)
      const data = await res.json()
      setPeers(data.peers || [])
      setForm({ url: '' })
    } catch (e: any) {
      setError(e?.message || 'Failed to add node')
    } finally {
      setSubmitting(false)
    }
  }

  async function removePeer(peerId: string) {
    setError(null)
    try {
      const body = JSON.stringify({ nodeId: peerId })
      const res = await fetch('/api/mesh/peers/remove', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body,
      })
      
      if (!res.ok) throw new Error(`Remove failed: ${res.status}`)
      const data = await res.json()
      setPeers(data.peers || [])
      
      // Track manually removed peer in localStorage
      const manuallyRemovedPeers = JSON.parse(localStorage.getItem('removedPeers') || '[]')
      if (!manuallyRemovedPeers.includes(peerId)) {
        manuallyRemovedPeers.push(peerId)
        localStorage.setItem('removedPeers', JSON.stringify(manuallyRemovedPeers))
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to remove node')
    }
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold">Constella</h1>
      <p className="text-white/70 mb-6">Add a peer node and view live traffic metrics. No clicks needed.</p>

      <div className="glass-panel p-4 mb-6">
        <div className="grid grid-cols-1 gap-3">
          <input className="bg-white/5 border border-white/10 rounded px-3 py-2" placeholder="Peer URL (http://localhost:3002)" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <button onClick={upsertPeer} disabled={submitting || !form.url} className="px-4 py-2 rounded bg-neonCyan/20 border border-neonCyan/40 hover:bg-neonCyan/30 disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add Node'}
          </button>
          {error && <span className="text-red-400 text-sm">{error}</span>}
        </div>
      </div>

      <div className="glass-panel p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-white/80">Live Metrics</div>
          <div className="text-white/50 text-xs">1-hour rolling window</div>
        </div>
        {Object.keys(framesByEdge).length === 0 ? (
          <div className="text-white/50 text-sm">No active connections. Add a peer to see live traffic.</div>
        ) : (
          <div className="space-y-4">
            {Object.entries(framesByEdge).map(([edge, samples]) => (
              <div key={edge} className="border border-white/10 rounded p-3">
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="text-white/80">{edge}</div>
                  <div className="text-white/60">RPS: {samples.at(-1)?.rps || 0} · p95: {Math.round(samples.at(-1)?.p95 || 0)}ms</div>
                </div>
                <Sparkline data={samples.map(s => s.rps)} />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="glass-panel p-4">
        <div className="text-white/80 mb-2">Known Peers</div>
        {peers.length === 0 ? (
          <div className="text-white/50 text-sm">No peers yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="text-left font-normal py-2">Name</th>
                  <th className="text-left font-normal py-2">URL</th>
                  <th className="text-left font-normal py-2">Added</th>
                  <th className="text-left font-normal py-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.url}</td>
                    <td className="py-2">{new Date(p.addedAt).toLocaleTimeString()}</td>
                    <td className="py-2">
                      <button
                        onClick={() => removePeer(p.id)}
                        className="px-2 py-1 text-xs bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 rounded text-red-300"
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  )
}

function Sparkline({ data }: { data: number[] }) {
  const width = 300
  const height = 60
  const max = Math.max(1, ...data)
  const points = data.map((v, i) => {
    const x = (i / Math.max(1, data.length - 1)) * width
    const y = height - (v / max) * height
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} className="block">
      <polyline fill="none" stroke="#4fd1c5" strokeWidth="2" points={points} />
    </svg>
  )
}
