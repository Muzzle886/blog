import type { Metadata } from 'next'
import './globals.css'
import '@/styles/markdown.css'
import { ThemeScript } from '@/components/theme-script'
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
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* nonce 由 ThemeScript 自行按环境读取，避免 dev 下的属性不匹配告警 */}
        <ThemeScript />
      </head>
      <body className="font-sans">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  )
}
