import { NextRequest, NextResponse } from 'next/server'
import { upsertPeer, listPeers } from '@/lib/registry'
import { MeshNode } from '@/lib/types'

export const runtime = 'nodejs'

// Adds a peer by URL with proper peer-to-peer discovery and gossip
export async function POST(req: NextRequest) {
  let data: { url: string }
  try {
    data = await req.json()
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }
  const { url } = data
  if (!url) return new NextResponse('missing url', { status: 400 })

  try {
    // Step 1: Get the remote node's info
    const remoteResponse = await fetch(`${url}/api/mesh/peers/info`)
    if (!remoteResponse.ok) {
      return new NextResponse(`Failed to fetch remote node info: ${remoteResponse.status}`, { status: 400 })
    }
    const remoteInfo = await remoteResponse.json()
    // No tombstones: single source of truth is .constella-peers.json
    
    // Step 2: Send our info to the remote node, along with our known peers
    const ourInfo = {
      node: {
        id: `node-${process.env.PORT || 'unknown'}`,
        name: process.env.NODE_NAME || 'Unknown',
        url: `http://localhost:${process.env.PORT || '3000'}`,
        region: process.env.NODE_REGION,
        provider: process.env.NODE_PROVIDER,
        addedAt: new Date().toISOString(),
        version: process.env.GIT_SHA || 'dev',
      },
      knownPeers: listPeers()
    }

    const upsertResponse = await fetch(`${url}/api/mesh/peers/upsert`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(ourInfo)
    })

    if (!upsertResponse.ok) {
      return new NextResponse(`Failed to register with remote node: ${upsertResponse.status}`, { status: 400 })
    }

    // Step 3: Register the remote node locally
    upsertPeer(remoteInfo.node)

    // Step 4: Get the updated peer list from remote (includes any peers they know about)
    const updatedPeers = await upsertResponse.json()
    if (updatedPeers.peers) {
      // Register any new peers we learned about
      updatedPeers.peers.forEach((peer: MeshNode) => {
        if (peer.id !== remoteInfo.node.id) {
          upsertPeer(peer)
        }
      })
    }

    // Step 5: Gossip to our existing peers about the new connection
    const currentPeers = listPeers()
    const gossipPromises = currentPeers
      .filter(peer => peer.id !== remoteInfo.node.id) // Don't gossip to the node we just connected to
      .map(async (peer) => {
        try {
          await fetch(`${peer.url}/api/mesh/peers/upsert`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              node: remoteInfo.node,
              knownPeers: [remoteInfo.node]
            })
          })
        } catch (error) {
          console.warn(`Failed to gossip to ${peer.url}:`, error)
        }
      })

    // Don't wait for gossip to complete
    Promise.allSettled(gossipPromises)

    return NextResponse.json({ peers: listPeers() })
  } catch (error) {
    console.error('Error adding peer:', error)
    return new NextResponse(`Failed to add peer: ${error}`, { status: 500 })
  }
}

