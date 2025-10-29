// Static mesh configuration
// These nodes will be considered available targets automatically.

export const STATIC_PEER_URLS: string[] = [
  'https://constellaspace.netlify.app',
  'https://constella-ivory.vercel.app',
  'https://constella-enya.onrender.com',
  'http://localhost:3001',
]

export const STATIC_PEERS = [
  {
    id: 'netlify',
    name: 'Netlify',
    url: 'https://constellaspace.netlify.app',
    region: 'us-east-1',
    provider: 'netlify',
    addedAt: new Date().toISOString(),
    version: '1.0.0'
  },
  {
    id: 'vercel',
    name: 'Vercel',
    url: 'https://constella-ivory.vercel.app',
    region: 'us-east-1',
    provider: 'vercel',
    addedAt: new Date().toISOString(),
    version: '1.0.0'
  },
  {
    id: 'render',
    name: 'Render',
    url: 'https://constella-enya.onrender.com',
    region: 'us-east-1',
    provider: 'render',
    addedAt: new Date().toISOString(),
    version: '1.0.0'
  },
  {
    id: 'local-node',
    name: 'Local Development',
    url: 'http://localhost:3001',
    region: 'local',
    provider: 'local',
    addedAt: new Date().toISOString(),
    version: 'dev'
  }
]


