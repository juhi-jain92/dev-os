import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Providers } from '@/app/providers'
import { AppHeader } from '@/components/ui/AppHeader'
import './globals.css'

// "Inter Display" per docs/design.md is not distributed via Google Fonts;
// Inter is the closest available match and shares the same typeface family.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'ContractIQ',
  description: 'AI-assisted NDA and MSA review — key terms, page attribution, and grounded chat.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={inter.variable}>
      <body>
        <Providers>
          <AppHeader />
          {children}
        </Providers>
      </body>
    </html>
  )
}
