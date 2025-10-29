import './globals.css'
import type { ReactNode } from 'react'

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen antialiased selection:bg-neonCyan/30 selection:text-white">
        <div className="fixed inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,rgba(168,124,255,0.15),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(107,255,229,0.1),transparent_60%)]" />
        {children}
      </body>
    </html>
  )
}

