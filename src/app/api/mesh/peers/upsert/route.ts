import { NextRequest, NextResponse } from 'next/server'
import { upsertPeer, upsertPeers, listPeers } from '@/lib/registry'
import { UpsertPeersRequest, UpsertPeersResponse } from '@/lib/types'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let payload: UpsertPeersRequest
  try {
    payload = await req.json()
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }
  
  // Register the new peer
  upsertPeer(payload.node)
  
  // Register any additional peers they know about
  if (payload.knownPeers?.length) {
    upsertPeers(payload.knownPeers)
  }
  
  // Return our current peer list (including the new one)
  const peers = listPeers()
  const res: UpsertPeersResponse = { peers }
  return NextResponse.json(res)
}

