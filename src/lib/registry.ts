import { MeshNode } from './types'

const peersById = new Map<string, MeshNode>()
const peersByUrl = new Map<string, string>()

export function upsertPeer(node: MeshNode): void {
  const existing = peersById.get(node.id)
  if (!existing) {
    peersById.set(node.id, node)
    peersByUrl.set(node.url, node.id)
    return
  }
  if (new Date(node.addedAt).getTime() >= new Date(existing.addedAt).getTime()) {
    peersById.set(node.id, { ...existing, ...node })
    if (existing.url !== node.url) {
      if (existing.url) peersByUrl.delete(existing.url)
      peersByUrl.set(node.url, node.id)
    }
  }
}

export function upsertPeers(nodes: MeshNode[]): void {
  for (const n of nodes) upsertPeer(n)
}

export function listPeers(): MeshNode[] {
  return Array.from(peersById.values())
}

export function getPeerByUrl(url: string): MeshNode | undefined {
  const id = peersByUrl.get(url)
  return id ? peersById.get(id) : undefined
}

export function removePeer(id: string): void {
  const n = peersById.get(id)
  if (n) {
    peersById.delete(id)
    peersByUrl.delete(n.url)
  }
}

// legacy no-op for compatibility if imported elsewhere
export function unblockPeer(_id?: string, _url?: string): void {}

