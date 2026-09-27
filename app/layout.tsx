import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import './globals.css'
import './refinements.css'
import './summer-fit-brand.css'

export const metadata: Metadata = {
  title: 'Summer Fit — Seu treino, agora no celular',
  description: 'Digitalize sua ficha da academia, registre cargas e acompanhe sua evolução com o Summer Fit.',
  applicationName: 'Summer Fit',
  manifest: '/manifest.webmanifest',
  appleWebApp: { capable: true, title: 'Summer Fit', statusBarStyle: 'black' },
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  colorScheme: 'light',
  themeColor: '#111111',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pt-BR">
      <body className="antialiased">
        {children}
        {process.env.NODE_ENV === 'production' && <Analytics />}
      </body>
    </html>
  )
}
