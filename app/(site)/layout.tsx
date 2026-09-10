import { Header } from '@/components/header'
import { SiteFooter } from '@/components/site-footer'
import { getCurrentUser } from '@/lib/auth'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"

/**
 * 站点外壳。
 * 头部需要展示登录态，因此这里读取 Cookie —— 该 layout 下的页面
 * 均为动态渲染，这是预期行为。
 */
export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <div className="flex min-h-screen flex-col">
      <Header user={user} siteName={siteName} />
      <main className="flex-1">{children}</main>
      <SiteFooter siteName={siteName} />
    </div>
  )
}
