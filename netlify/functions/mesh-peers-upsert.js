const { upsertPeer, upsertPeers, listPeers } = require('../../src/lib/registry')

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const payload = JSON.parse(event.body)
    
    // Register the new peer
    upsertPeer(payload.node)
    
    // Register any additional peers they know about
    if (payload.knownPeers?.length) {
      upsertPeers(payload.knownPeers)
    }
    
    // Return our current peer list (including the new one)
    const peers = listPeers()
    
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
    console.error('Error in mesh-peers-upsert:', error)
    return {
      statusCode: 400,
      body: JSON.stringify({ error: 'Bad request' })
    }
  }
}
