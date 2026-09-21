import type { Metadata, Viewport } from 'next'
import './globals.css'
import { getT } from '@/i18n/server'
import { LocaleProvider } from '@/i18n/client'
import { fontVariables } from './fonts'

export const metadata: Metadata = {
  title: 'Favie — AI that runs your Uber Eats & DoorDash',
  description:
    'Favie manages your Uber Eats and DoorDash every day — ads, promotions, store health — so you get more delivery orders and keep more margin. $299/mo per restaurant.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'),
  // iPhone home-screen icon → full-screen web app with its own persistent storage (see manifest.ts).
  appleWebApp: { capable: true, title: 'Favie', statusBarStyle: 'default' },
  openGraph: {
    title: 'Favie — AI that runs your Uber Eats & DoorDash',
    description: 'More delivery orders. More margin. Zero daily work.',
    type: 'website',
  },
}

// Phone: the page is exactly as wide as the screen and cannot be zoomed or panned sideways (focusing a small
// input used to zoom the page, after which it could be dragged off to a white edge).
export const viewport: Viewport = {
  width: 'device-width', initialScale: 1, maximumScale: 1, userScalable: false, viewportFit: 'cover', themeColor: '#f3f4f6',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { locale, dict } = await getT()
  return (
    <html lang={locale} className={fontVariables}>
      <body className="min-h-screen font-sans"><LocaleProvider locale={locale} dict={dict}>{children}</LocaleProvider></body>
    </html>
  )
}
