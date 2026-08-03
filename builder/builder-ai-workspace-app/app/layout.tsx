import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Noto_Sans_JP, Geist_Mono } from 'next/font/google'
import { TASFUL_BUILDER_AI_SCRIPTS } from '@/lib/tasful-scripts'
import './globals.css'

const notoSansJp = Noto_Sans_JP({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-sans',
})

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Builder AI | 建設現場専用AIワークスペース',
  description:
    '自然文で入力するだけで見積・原価計算・見積書・工程表・請求書などをAIが自動で作成する、建設業向けAIワークスペース。',
}

export const viewport: Viewport = {
  themeColor: '#1a1f35',
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ja" className={`${notoSansJp.variable} ${geistMono.variable} bg-background`}>
      <head>
        {TASFUL_BUILDER_AI_SCRIPTS.map((src) => (
          <Script key={src} src={src} strategy="beforeInteractive" />
        ))}
      </head>
      <body className="font-sans antialiased" data-builder-ai-workspace="1" data-page="builder-ai">
        {/* Legacy panel mount (hidden) — existing Cost/Doc panels need hosts; V0 cards remain visible UI */}
        <div
          id="tasful-builder-ai-legacy-mount"
          aria-hidden="true"
          style={{
            position: 'fixed',
            width: 1,
            height: 1,
            overflow: 'hidden',
            clip: 'rect(0 0 0 0)',
            whiteSpace: 'nowrap',
            border: 0,
            padding: 0,
            margin: -1,
          }}
        >
          <div data-builder-ai-ui-messages role="presentation" />
        </div>
        {children}
      </body>
    </html>
  )
}
