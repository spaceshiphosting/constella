const { listPeers } = require('../../src/lib/registry')
const { readFileSync, existsSync } = require('fs')
const { join } = require('path')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const host = event.headers.host || `localhost:${process.env.PORT || '3000'}`
    const proto = event.headers['x-forwarded-proto'] || 'http'
    const selfUrl = `${proto}://${host}`
    let peers = listPeers().filter((p) => p.url !== selfUrl)

    // Fallback: if in-memory registry is empty, read from disk
    if (peers.length === 0) {
      try {
        const baseDir = process.env.NETLIFY ? '/tmp' : process.cwd()
        const file = join(baseDir, '.constella-peers.json')
        if (existsSync(file)) {
          const data = readFileSync(file, 'utf8')
          const diskPeers = JSON.parse(data)
          peers = (Array.isArray(diskPeers) ? diskPeers : [])
            .filter((p) => p && p.url !== selfUrl)
        }
      } catch (error) {
        console.warn('Failed to load peers from disk:', error)
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ peers })
    }
  } catch (error) {
    console.error('Error in mesh-peers:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
