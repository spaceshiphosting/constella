import { NextRequest, NextResponse } from 'next/server'
import { MeshNode } from '@/lib/types'
import { createHash } from 'crypto'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || `localhost:${process.env.PORT || '3000'}`
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const selfUrl = `${proto}://${host}`
  const name = process.env.NODE_NAME || (process.env.NODE_PROVIDER || 'unknown')
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-')

  const node: MeshNode = {
    id,
    name,
    url: selfUrl,
    region: process.env.NODE_REGION,
    provider: process.env.NODE_PROVIDER,
    addedAt: new Date().toISOString(),
    version: process.env.GIT_SHA || 'dev',
  }

  return NextResponse.json({ node })
}
