import { NextResponse } from 'next/server'
import { MeshNode } from '@/lib/types'

export const runtime = 'nodejs'

export async function GET() {
  const node: MeshNode = {
    id: `node-${process.env.PORT || 'unknown'}`,
    name: process.env.NODE_NAME || 'Unknown',
    url: `http://localhost:${process.env.PORT || '3000'}`,
    region: process.env.NODE_REGION,
    provider: process.env.NODE_PROVIDER,
    addedAt: new Date().toISOString(),
    version: process.env.GIT_SHA || 'dev',
  }

  return NextResponse.json({ node })
}
