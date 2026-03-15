import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Pharma Sourcing Agent',
  description: 'AI 기반 의약품 원료 소싱 자동화 시스템',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  )
}
