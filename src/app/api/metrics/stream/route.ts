import { NextRequest } from 'next/server'
import { subscribe } from '@/lib/metrics'
import { startTrafficGenerator } from '@/lib/generator'

export const runtime = 'nodejs'

export async function GET(_req: NextRequest) {
  // Ensure generator is running
  startTrafficGenerator()

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const write = (data: string) => {
        if (closed) return
        try { controller.enqueue(encoder.encode(data)) } catch { /* ignore */ }
      }
      const unsubscribe = subscribe({
        write,
        close: () => {
          if (closed) return
          closed = true
          try { controller.close() } catch {}
          unsubscribe()
        }
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => write(': keep-alive\n\n'), 15000)
      controller.enqueue(encoder.encode('event: open\n\n'))
      // Cleanup on cancel
      return () => {
        clearInterval(heartbeat)
        try { unsubscribe() } catch {}
      }
    },
    cancel() {},
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}


