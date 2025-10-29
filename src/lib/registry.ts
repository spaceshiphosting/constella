import { MeshNode } from './types'
import { writeFileSync, readFileSync, existsSync } from 'fs'
import { join } from 'path'

const peersById = new Map<string, MeshNode>()
const peersByUrl = new Map<string, string>()

// On Vercel, the filesystem is read-only except for /tmp. Use /tmp there.
const persistenceBaseDir = process.env.VERCEL ? '/tmp' : process.cwd()
const PERSISTENCE_FILE = join(persistenceBaseDir, '.constella-peers.json')

// Load peers from disk on startup
function loadPeersFromDisk(): void {
  try {
    if (existsSync(PERSISTENCE_FILE)) {
      const data = readFileSync(PERSISTENCE_FILE, 'utf8')
      const peers: MeshNode[] = JSON.parse(data)
      for (const peer of peers) {
        peersById.set(peer.id, peer)
        peersByUrl.set(peer.url, peer.id)
      }
      console.log(`Loaded ${peers.length} peers from disk`)
    }
  } catch (error) {
    console.warn('Failed to load peers from disk:', error)
  }
}

// Save peers to disk
function savePeersToDisk(): void {
  try {
    const peers = Array.from(peersById.values())
    writeFileSync(PERSISTENCE_FILE, JSON.stringify(peers, null, 2))
  } catch (error) {
    console.warn('Failed to save peers to disk:', error)
  }
}

// Initialize on module load
loadPeersFromDisk()

export function upsertPeer(node: MeshNode): void {
  const existing = peersById.get(node.id)
  if (!existing) {
    peersById.set(node.id, node)
    peersByUrl.set(node.url, node.id)
    savePeersToDisk()
    return
  }
  if (new Date(node.addedAt).getTime() >= new Date(existing.addedAt).getTime()) {
    peersById.set(node.id, { ...existing, ...node })
    if (existing.url !== node.url) {
      if (existing.url) peersByUrl.delete(existing.url)
      peersByUrl.set(node.url, node.id)
    }
    savePeersToDisk()
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
    savePeersToDisk()
  }
}

// legacy no-op for compatibility if imported elsewhere
export function unblockPeer(_id?: string, _url?: string): void {}

