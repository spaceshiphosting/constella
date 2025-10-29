import { NextRequest, NextResponse } from 'next/server'
import { listPeers } from '@/lib/registry'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'

export async function GET(req: NextRequest) {
  const host = req.headers.get('host') || `localhost:${process.env.PORT || '3000'}`
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  const selfUrl = `${proto}://${host}`
  let peers = listPeers().filter((p) => p.url !== selfUrl)

  // Fallback: if in-memory registry is empty (e.g., after HMR), read from disk
  if (peers.length === 0) {
    try {
      const baseDir = process.env.VERCEL ? '/tmp' : process.cwd()
      const file = join(baseDir, '.constella-peers.json')
      if (existsSync(file)) {
        const data = readFileSync(file, 'utf8')
        const diskPeers = JSON.parse(data)
        peers = (Array.isArray(diskPeers) ? diskPeers : [])
          .filter((p: any) => p && p.url !== selfUrl)
      }
    } catch {}
  }
  return NextResponse.json({ peers })
}

