export type MeshNode = {
  id: string
  name: string
  url: string
  region?: string
  provider?: 'vercel' | 'cloudflare' | 'aws' | 'gcp' | 'azure' | string
  addedAt: string
  version: string
}

export type UpsertPeersRequest = {
  node: MeshNode
  knownPeers?: MeshNode[]
}

export type UpsertPeersResponse = {
  peers: MeshNode[]
}

export type MetricFrame = {
  ts: number
  nodeId: string
  targetId: string
  rps: number
  p50: number
  p95: number
  p99: number
  errors: Record<'4xx' | '5xx', number>
  bytesOut: number
  samples: number
}

export type TrafficConfig = {
  outboundRps: number
  payloadSizeBytes: number
  jitterMs: number
  burstPercent: number
  errorInjectPercent: number
}

