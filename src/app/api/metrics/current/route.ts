import { NextResponse } from 'next/server'
import { getCurrentMetricsData } from '@/lib/metrics'
import { startTrafficGenerator } from '@/lib/generator'

export const runtime = 'nodejs'

// Ensure the traffic generator starts when this route is accessed
startTrafficGenerator()

export async function GET() {
  try {
    const data = getCurrentMetricsData()
    return NextResponse.json(data)
  } catch (error) {
    console.error('Error getting current metrics:', error)
    return NextResponse.json({ error: 'Failed to get metrics' }, { status: 500 })
  }
}
