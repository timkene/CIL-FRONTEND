import type { Metadata } from 'next'
import { Manrope } from 'next/font/google'
import './globals.css'
import AppShell from '@/components/AppShell'

const manrope = Manrope({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Clearline Analytics',
  description: 'Healthcare analytics dashboard',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${manrope.className} bg-[#f6f7f8] text-slate-900`}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
