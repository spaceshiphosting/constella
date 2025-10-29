exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    }
  }

  try {
    const node = {
      id: `node-${process.env.PORT || 'unknown'}`,
      name: process.env.NODE_NAME || 'Unknown',
      url: `https://${event.headers.host}`,
      region: process.env.NODE_REGION,
      provider: process.env.NODE_PROVIDER || 'netlify',
      addedAt: new Date().toISOString(),
      version: process.env.GIT_SHA || 'dev',
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
      },
      body: JSON.stringify({ node })
    }
  } catch (error) {
    console.error('Error in mesh-peers-info:', error)
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' })
    }
  }
}
