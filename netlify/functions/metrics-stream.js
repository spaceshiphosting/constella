const { subscribe } = require('../../src/lib/metrics')
const { startTrafficGenerator } = require('../../src/lib/generator')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  // Ensure generator is running
  startTrafficGenerator()

  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()
      let closed = false
      const write = (data) => {
        if (closed) return
        try { 
          controller.enqueue(encoder.encode(data)) 
        } catch (error) {
          console.warn('Stream write error:', error)
        }
      }
      
      const unsubscribe = subscribe({
        write,
        close: () => {
          if (closed) return
          closed = true
          try { 
            controller.close() 
          } catch (error) {
            console.warn('Stream close error:', error)
          }
          unsubscribe()
        }
      })

      // Heartbeat to keep connection alive
      const heartbeat = setInterval(() => write(': keep-alive\n\n'), 15000)
      controller.enqueue(encoder.encode('event: open\n\n'))
      
      // Cleanup on cancel
      return () => {
        clearInterval(heartbeat)
        try { 
          unsubscribe() 
        } catch (error) {
          console.warn('Unsubscribe error:', error)
        }
      }
    },
    cancel() {
      console.log('Stream cancelled')
    },
  })

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
    },
    body: stream
  }
}
