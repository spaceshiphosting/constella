"use client"
import { useEffect, useState } from 'react'
import { STATIC_PEERS } from '@/lib/config'

type Peer = { id: string; name: string; url: string; region?: string; provider?: string; addedAt: string; version: string }

export default function HomePage() {
  const [peers, setPeers] = useState<Peer[]>(STATIC_PEERS)
  const [framesByEdge, setFramesByEdge] = useState<Record<string, { ts: number; rps: number; p95: number }[]>>({})

  // Initialize with static peers
  useEffect(() => {
    setPeers(STATIC_PEERS)
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



  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Constella</h1>
          <p className="text-white/70">Multi-cloud serverless mesh with live traffic metrics.</p>
        </div>
        <div className="text-right">
          <div className="text-white/80 text-sm">Current Node</div>
          <div className="text-neonCyan font-medium">{process.env.NODE_NAME || 'Unknown'}</div>
        </div>
      </div>


      <div className="glass-panel p-4 mb-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-white/80">Live Metrics</div>
          <div className="text-white/50 text-xs">1-hour rolling window</div>
        </div>
        {Object.keys(framesByEdge).length === 0 ? (
          <div className="text-white/50 text-sm">No active connections. Connect to nodes to see live traffic.</div>
        ) : (
          <div className="space-y-6">
            {/* RPS Chart Section */}
            <div className="border border-white/10 rounded p-4">
              <div className="text-white/80 mb-3">Requests Per Second (RPS)</div>
              <div className="text-white/50 text-xs mb-4">1-hour rolling window</div>
              <MultiLineChart 
                data={framesByEdge} 
                metric="rps" 
                color="#4fd1c5"
                unit="RPS"
                getCurrentValue={(samples) => samples.at(-1)?.rps || 0}
                getAverageValue={(samples) => samples.length > 0 ? (samples.reduce((sum, s) => sum + s.rps, 0) / samples.length).toFixed(1) : '0'}
              />
            </div>

            {/* Latency Chart Section */}
            <div className="border border-white/10 rounded p-4">
              <div className="text-white/80 mb-3">Response Time (p95 Latency)</div>
              <div className="text-white/50 text-xs mb-4">1-hour rolling window</div>
              <MultiLineChart 
                data={framesByEdge} 
                metric="p95" 
                color="#ff6b6b"
                unit="ms"
                getCurrentValue={(samples) => Math.round(samples.at(-1)?.p95 || 0)}
                getAverageValue={(samples) => samples.length > 0 ? Math.round(samples.reduce((sum, s) => sum + s.p95, 0) / samples.length) : 0}
              />
            </div>
          </div>
        )}
      </div>

      <div className="glass-panel p-4">
        <div className="text-white/80 mb-2">Connected Peers</div>
        {peers.length === 0 ? (
          <div className="text-white/50 text-sm">No peers connected yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-white/60">
                <tr>
                  <th className="text-left font-normal py-2">Name</th>
                  <th className="text-left font-normal py-2">URL</th>
                  <th className="text-left font-normal py-2">Provider</th>
                </tr>
              </thead>
              <tbody>
                {peers.map((p) => (
                  <tr key={p.id} className="border-t border-white/10">
                    <td className="py-2">{p.name}</td>
                    <td className="py-2">{p.url}</td>
                    <td className="py-2">
                      <span className="text-xs bg-white/10 px-2 py-1 rounded">
                        {p.provider}
                      </span>
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

function MultiLineChart({ 
  data, 
  metric, 
  color, 
  unit, 
  getCurrentValue, 
  getAverageValue 
}: { 
  data: Record<string, { ts: number; rps: number; p95: number }[]>
  metric: 'rps' | 'p95'
  color: string
  unit: string
  getCurrentValue: (samples: { ts: number; rps: number; p95: number }[]) => number | string
  getAverageValue: (samples: { ts: number; rps: number; p95: number }[]) => number | string
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 600
  const height = 200
  
  // Get all data points for scaling
  const allValues = Object.values(data).flat().map(d => d[metric])
  const maxValue = Math.max(1, ...allValues)
  
  // Generate colors for each line
  const colors = ['#4fd1c5', '#ff6b6b', '#fbbf24', '#8b5cf6', '#10b981', '#f59e0b']
  
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = e.clientX - rect.left
    const index = Math.round((x / width) * Math.max(1, allValues.length - 1))
    setHoveredIndex(Math.max(0, Math.min(index, allValues.length - 1)))
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  return (
    <div className="relative">
      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-4">
        {Object.entries(data).map(([edge, samples], index) => {
          // Extract destination node name from edge (format: "source->destination")
          const destination = edge.split('->')[1] || edge
          return (
            <div key={edge} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full" 
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-sm text-white/80">{destination}</span>
              <span className="text-xs text-white/60">
                Current: {getCurrentValue(samples)}{unit} · Avg: {getAverageValue(samples)}{unit}
              </span>
            </div>
          )
        })}
      </div>

      <svg 
        width={width} 
        height={height} 
        className="block cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        {/* Grid lines */}
        <line x1="0" y1={height * 0.25} x2={width} y2={height * 0.25} stroke="#333" strokeWidth="1" opacity="0.3" />
        <line x1="0" y1={height * 0.5} x2={width} y2={height * 0.5} stroke="#333" strokeWidth="1" opacity="0.3" />
        <line x1="0" y1={height * 0.75} x2={width} y2={height * 0.75} stroke="#333" strokeWidth="1" opacity="0.3" />
        
        {/* Draw lines for each edge */}
        {Object.entries(data).map(([edge, samples], edgeIndex) => {
          const points = samples.map((d, i) => {
            const x = (i / Math.max(1, samples.length - 1)) * width
            const y = height - (d[metric] / maxValue) * height
            return `${x},${y}`
          }).join(' ')
          
          return (
            <g key={edge}>
              <polyline 
                fill="none" 
                stroke={colors[edgeIndex % colors.length]} 
                strokeWidth="2" 
                points={points} 
              />
              {hoveredIndex !== null && samples[hoveredIndex] && (
                <circle
                  cx={(hoveredIndex / Math.max(1, samples.length - 1)) * width}
                  cy={height - (samples[hoveredIndex][metric] / maxValue) * height}
                  r="4"
                  fill={colors[edgeIndex % colors.length]}
                  stroke="white"
                  strokeWidth="2"
                />
              )}
            </g>
          )
        })}
      </svg>
      
      {/* Y-axis labels */}
      <div className="absolute left-0 top-0 text-xs text-white/50">
        <div style={{ transform: 'translateY(-4px)' }}>{Math.round(maxValue)}{unit}</div>
        <div style={{ transform: `translateY(${height * 0.25 - 4}px)` }}>{Math.round(maxValue * 0.75)}{unit}</div>
        <div style={{ transform: `translateY(${height * 0.5 - 4}px)` }}>{Math.round(maxValue * 0.5)}{unit}</div>
        <div style={{ transform: `translateY(${height * 0.75 - 4}px)` }}>{Math.round(maxValue * 0.25)}{unit}</div>
        <div style={{ transform: `translateY(${height - 4}px)` }}>0{unit}</div>
      </div>
      
      {/* Hover tooltip */}
      {hoveredIndex !== null && (
        <div className="absolute top-0 right-0 bg-black/80 border border-white/20 rounded px-3 py-2 text-xs text-white">
          <div className="text-white/60 mb-1">
            {Object.values(data)[0]?.[hoveredIndex] ? 
              new Date(Object.values(data)[0][hoveredIndex].ts).toLocaleTimeString() : 
              'Time'
            }
          </div>
          {Object.entries(data).map(([edge, samples], index) => {
            const sample = samples[hoveredIndex]
            if (!sample) return null
            const destination = edge.split('->')[1] || edge
            return (
              <div key={edge} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span>{destination}: {Math.round(sample[metric])}{unit}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}