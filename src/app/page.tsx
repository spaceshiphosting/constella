"use client"
import { useEffect, useState, useMemo } from 'react'
import { STATIC_PEERS, NODE_COLORS } from '@/lib/config'

type Peer = { id: string; name: string; url: string; region?: string; provider?: string; addedAt: string; version: string }

type TimeWindow = '1h' | '30m' | '10m' | '5m' | '1m'

const TIME_WINDOWS: { value: TimeWindow; label: string; ms: number }[] = [
  { value: '1h', label: '1 Hour', ms: 60 * 60 * 1000 },
  { value: '30m', label: '30 Minutes', ms: 30 * 60 * 1000 },
  { value: '10m', label: '10 Minutes', ms: 10 * 60 * 1000 },
  { value: '5m', label: '5 Minutes', ms: 5 * 60 * 1000 },
  { value: '1m', label: '1 Minute', ms: 1 * 60 * 1000 },
]

export default function HomePage() {
  const [peers, setPeers] = useState<Peer[]>(STATIC_PEERS)
  const [framesByEdge, setFramesByEdge] = useState<Record<string, { ts: number; rps: number; p95: number }[]>>({})
  const [selfName, setSelfName] = useState<string>('Unknown')
  const [timeWindow, setTimeWindow] = useState<TimeWindow>('1m')

  // Initialize with static peers
  useEffect(() => {
    setPeers(STATIC_PEERS)
  }, [])

  // Load initial metrics data on page load
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        const response = await fetch('/api/metrics/current')
        if (response.ok) {
          const data = await response.json()
          setFramesByEdge(data)
        }
      } catch (error) {
        console.warn('Failed to load initial metrics:', error)
      }
    }
    
    loadInitialData()
  }, [])

  // Load current node info (name) from server
  useEffect(() => {
    const loadSelf = async () => {
      try {
        const res = await fetch('/api/mesh/peers/info')
        if (res.ok) {
          const json = await res.json()
          if (json?.node?.name) setSelfName(json.node.name)
        }
      } catch {}
    }
    loadSelf()
  }, [])

  // Get current time window in milliseconds
  const currentTimeWindowMs = TIME_WINDOWS.find(w => w.value === timeWindow)?.ms || 10 * 60 * 1000

  // Auto-connect to SSE on load with throttling
  useEffect(() => {
    const es = new EventSource('/api/metrics/stream')
    let lastUpdate = 0
    const UPDATE_THROTTLE = 100 // Update UI max every 100ms
    
    es.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as { ts: number; nodeId: string; targetId: string; rps: number; p95: number }[]
        const now = Date.now()
        
        // Throttle UI updates
        if (now - lastUpdate < UPDATE_THROTTLE) return
        lastUpdate = now
        
        setFramesByEdge((prev) => {
          const copy = { ...prev }
          const timeWindowAgo = now - currentTimeWindowMs
          
          for (const f of parsed) {
            const key = `${f.nodeId}->${f.targetId}`
            const arr = copy[key] || []
            arr.push({ ts: f.ts, rps: f.rps, p95: f.p95 })
            
            // Keep only data from the selected time window
            const filtered = arr.filter(sample => sample.ts > timeWindowAgo)
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
  }, [currentTimeWindowMs])

  // Memoized chart data processing for better performance
  const chartData = useMemo(() => {
    const timeWindowAgo = Date.now() - currentTimeWindowMs
    return Object.entries(framesByEdge).reduce((acc, [edge, frames]) => {
      // Filter frames to only include data within the selected time window
      const filteredFrames = frames.filter(frame => frame.ts > timeWindowAgo)
      if (filteredFrames.length > 0) acc[edge] = filteredFrames
      return acc
    }, {} as Record<string, { ts: number; rps: number; p95: number }[]>)
  }, [framesByEdge, currentTimeWindowMs])

  // Get colors for each edge based on destination node
  const getEdgeColor = (edge: string) => {
    const destination = edge.split('->')[1] || edge
    // Try to match by hostname or full URL
    for (const [key, color] of Object.entries(NODE_COLORS)) {
      if (destination.includes(key) || edge.includes(key)) {
        return color
      }
    }
    // Fallback to default color
    return '#4fd1c5'
  }

  return (
    <main className="min-h-screen p-6 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Constella</h1>
          <p className="text-white/70">Multi-cloud serverless mesh with live traffic metrics.</p>
        </div>
        <div className="text-right">
          <div className="text-white/80 text-sm">Current Node</div>
          <div className="text-neonCyan font-medium">{selfName}</div>
        </div>
      </div>


      <div className="glass-panel p-4 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-white/80">Live Metrics</div>
          <div className="flex items-center gap-3">
            <span className="text-white/50 text-xs">Time Window:</span>
            <select
              value={timeWindow}
              onChange={(e) => setTimeWindow(e.target.value as TimeWindow)}
              className="bg-white/10 border border-white/20 rounded px-3 py-1 text-sm text-white focus:outline-none focus:border-neonCyan/50"
            >
              {TIME_WINDOWS.map((window) => (
                <option key={window.value} value={window.value} className="bg-gray-800">
                  {window.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        {Object.keys(chartData).length === 0 ? (
          <div className="text-white/50 text-sm">No active connections. Connect to nodes to see live traffic.</div>
        ) : (
          <div className="space-y-6">
            {/* Single Legend for All Charts */}
            <div className="flex flex-wrap gap-4 mb-4">
              {Object.entries(chartData).map(([edge, samples]) => {
                const destination = edge.split('->')[1] || edge
                const edgeColor = getEdgeColor(edge)
                return (
                  <div key={edge} className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: edgeColor }}
                    />
                    <span className="text-sm text-white/80">{destination}</span>
                    <span className="text-xs text-white/60">
                      RPS: {samples.at(-1)?.rps || 0} · Latency: {Math.round(samples.at(-1)?.p95 || 0)}ms
                    </span>
                  </div>
                )
              })}
            </div>

            {/* RPS Chart Section */}
            <div className="border border-white/10 rounded p-4">
              <div className="text-white/80 mb-3">Requests Per Second (RPS)</div>
              <div className="text-white/50 text-xs mb-4">1-hour rolling window</div>
              <MultiLineChart 
                data={chartData} 
                metric="rps" 
                color="#4fd1c5"
                unit="RPS"
                getCurrentValue={(samples) => samples.at(-1)?.rps || 0}
                getAverageValue={(samples) => samples.length > 0 ? (samples.reduce((sum, s) => sum + s.rps, 0) / samples.length).toFixed(1) : '0'}
                showLegend={false}
              />
            </div>

            {/* Latency Chart Section */}
            <div className="border border-white/10 rounded p-4">
              <div className="text-white/80 mb-3">Response Time (p95 Latency)</div>
              <div className="text-white/50 text-xs mb-4">1-hour rolling window</div>
              <MultiLineChart 
                data={chartData} 
                metric="p95" 
                color="#ff6b6b"
                unit="ms"
                getCurrentValue={(samples) => Math.round(samples.at(-1)?.p95 || 0)}
                getAverageValue={(samples) => samples.length > 0 ? Math.round(samples.reduce((sum, s) => sum + s.p95, 0) / samples.length) : 0}
                showLegend={false}
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
  getAverageValue,
  showLegend = true
}: { 
  data: Record<string, { ts: number; rps: number; p95: number }[]>
  metric: 'rps' | 'p95'
  color: string
  unit: string
  getCurrentValue: (samples: { ts: number; rps: number; p95: number }[]) => number | string
  getAverageValue: (samples: { ts: number; rps: number; p95: number }[]) => number | string
  showLegend?: boolean
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const width = 600
  const height = 200
  
  // Get all data points for scaling
  const allValues = Object.values(data).flat().map(d => d[metric])
  const maxValue = Math.max(1, ...allValues)
  
  // Get colors for each edge based on destination node
  const getEdgeColor = (edge: string) => {
    const destination = edge.split('->')[1] || edge
    // Try to match by hostname or full URL
    for (const [key, color] of Object.entries(NODE_COLORS)) {
      if (destination.includes(key) || edge.includes(key)) {
        return color
      }
    }
    // Fallback to default color
    return '#4fd1c5'
  }
  
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
      {/* Legend - only show if showLegend is true */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 mb-4">
          {Object.entries(data).map(([edge, samples]) => {
            // Extract destination node name from edge (format: "source->destination")
            const destination = edge.split('->')[1] || edge
            const edgeColor = getEdgeColor(edge)
            return (
              <div key={edge} className="flex items-center gap-2">
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: edgeColor }}
                />
                <span className="text-sm text-white/80">{destination}</span>
                <span className="text-xs text-white/60">
                  Current: {getCurrentValue(samples)}{unit} · Avg: {getAverageValue(samples)}{unit}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <svg 
        width={width} 
        height={height} 
        className="block cursor-crosshair"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
          {/* Grid lines */}
          <line x1="0" y1={height * 0.8} x2={width} y2={height * 0.8} stroke="#333" strokeWidth="1" opacity="0.3" />
          <line x1="0" y1={height * 0.6} x2={width} y2={height * 0.6} stroke="#333" strokeWidth="1" opacity="0.3" />
          <line x1="0" y1={height * 0.4} x2={width} y2={height * 0.4} stroke="#333" strokeWidth="1" opacity="0.3" />
          <line x1="0" y1={height * 0.2} x2={width} y2={height * 0.2} stroke="#333" strokeWidth="1" opacity="0.3" />
          
          {/* Draw lines for each edge */}
          {Object.entries(data).map(([edge, samples]) => {
            const points = samples.map((d, i) => {
              const x = (i / Math.max(1, samples.length - 1)) * width
              const y = height - (d[metric] / maxValue) * height
              return `${x},${y}`
            }).join(' ')
            
            const edgeColor = getEdgeColor(edge)
            
            return (
              <g key={edge}>
                <polyline 
                  fill="none" 
                  stroke={edgeColor} 
                  strokeWidth="2" 
                  points={points} 
                />
                {hoveredIndex !== null && samples[hoveredIndex] && (
                  <circle
                    cx={(hoveredIndex / Math.max(1, samples.length - 1)) * width}
                    cy={height - (samples[hoveredIndex][metric] / maxValue) * height}
                    r="4"
                    fill={edgeColor}
                    stroke="white"
                    strokeWidth="2"
                  />
                )}
              </g>
            )
        })}
      </svg>
      
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
            const edgeColor = getEdgeColor(edge)
            return (
              <div key={edge} className="flex items-center gap-2">
                <div 
                  className="w-2 h-2 rounded-full" 
                  style={{ backgroundColor: edgeColor }}
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