// Static mesh configuration
// These nodes will be considered available targets automatically.

export const STATIC_PEER_URLS: string[] = [
  'https://constellaspace.netlify.app',
  'https://constella-ivory.vercel.app',
  'https://constella-enya.onrender.com',
  'https://constella-135766916723.europe-west1.run.app'
]

export const STATIC_PEERS = [
  {
    id: 'netlify',
    name: 'Netlify',
    url: 'https://constellaspace.netlify.app',
    region: 'us-east-1',
    provider: 'netlify',
    addedAt: new Date().toISOString(),
    version: '1.0.0',
    color: '#00D4FF' // Bright Star Blue - like a bright star in the constellation
  },
  {
    id: 'vercel',
    name: 'Vercel',
    url: 'https://constella-ivory.vercel.app',
    region: 'us-east-1',
    provider: 'vercel',
    addedAt: new Date().toISOString(),
    version: '1.0.0',
    color: '#FFD700' // Golden Star - the brightest star in the constellation
  },
  {
    id: 'render',
    name: 'Render',
    url: 'https://constella-enya.onrender.com',
    region: 'us-east-1',
    provider: 'render',
    addedAt: new Date().toISOString(),
    version: '1.0.0',
    color: '#FF6B9D' // Nebula Pink - like a distant nebula
  },
  {
    id: 'google-run',
    name: 'Cloud Run (EU)',
    url: 'https://constella-135766916723.europe-west1.run.app',
    region: 'europe-west1',
    provider: 'gcp',
    addedAt: new Date().toISOString(),
    version: '1.0.0',
    color: '#34D399' // Aurora Green - fresh node in the constellation
  }
]

// Color mapping for easy lookup
export const NODE_COLORS: Record<string, string> = {
  'netlify': '#00D4FF',
  'vercel': '#FFD700',
  'render': '#FF6B9D',
  'local-node': '#9D4EDD',
  'constellaspace.netlify.app': '#00D4FF',
  'constella-ivory.vercel.app': '#FFD700',
  'constella-enya.onrender.com': '#FF6B9D',
  'constella-135766916723.europe-west1.run.app': '#34D399',
  'localhost:3001': '#9D4EDD'
}


