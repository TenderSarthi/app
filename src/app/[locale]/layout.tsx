import type { Metadata, Viewport } from 'next'
import { Poppins, Inter } from 'next/font/google'
import { NextIntlClientProvider } from 'next-intl'
import { getMessages } from 'next-intl/server'
import { Providers } from '@/components/providers'
import '../globals.css'

const poppins = Poppins({ subsets: ['latin'], weight: ['400','600','700'], variable: '--font-poppins', display: 'swap' })
const inter   = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata: Metadata = {
  title: 'TenderSarthi — सरकारी टेंडर जीतो, आसानी से',
  description: 'AI-powered GeM tender assistant for Indian vendors.',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: 'TenderSarthi' },
}

export const viewport: Viewport = { themeColor: '#1A3766', width: 'device-width', initialScale: 1, maximumScale: 1 }

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  const messages = await getMessages()
  return (
    <html lang={locale} className={`${poppins.variable} ${inter.variable}`}>
      <body className="bg-lightbg font-body antialiased">
        <NextIntlClientProvider messages={messages}>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
