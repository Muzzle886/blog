import type { Metadata } from 'next'
import './globals.css'
import '@/styles/markdown.css'
import { ThemeScript, getNonce } from '@/components/theme-script'
import { ToastProvider } from '@/components/ui/toast'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

export const metadata: Metadata = {
  title: {
    default: siteName,
    template: `%s · ${siteName}`,
  },
  description: '记录技术、产品与生活的独立博客',
  metadataBase: new URL(siteUrl),
  openGraph: {
    title: siteName,
    description: '记录技术、产品与生活的独立博客',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // nonce 由 middleware.ts 生成并通过 x-nonce 头透传，供内联主题脚本通过 CSP
  const nonce = getNonce()

  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        <ThemeScript nonce={nonce} />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
