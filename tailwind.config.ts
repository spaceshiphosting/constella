import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B1020',
        neonCyan: '#6BFFE5',
        neonViolet: '#A87CFF',
        neonMagenta: '#FF4D6D',
      },
      boxShadow: {
        innerGlow: 'inset 0 0 40px rgba(107, 255, 229, 0.12)',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
}

export default config

