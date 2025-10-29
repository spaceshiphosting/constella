import { NextResponse } from 'next/server'
import '@/lib/generator' // ensure traffic generator auto-starts on server

export const runtime = 'nodejs'

export async function GET() {
  return new NextResponse(null, { status: 204 })
}

