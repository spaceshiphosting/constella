import { NextRequest, NextResponse } from 'next/server'
import { removePeer, listPeers } from '@/lib/registry'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  let data: { nodeId: string }
  try {
    data = await req.json()
  } catch {
    return new NextResponse('bad request', { status: 400 })
  }

  const { nodeId } = data
  if (!nodeId) {
    return new NextResponse('missing nodeId', { status: 400 })
  }

  removePeer(nodeId)
  const peers = listPeers()

  return NextResponse.json({ peers })
}
