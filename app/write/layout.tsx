import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"

/** 写作区布局：只保留返回首页、主题切换与用户菜单，把屏幕让给编辑区 */
export default async function WriteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fwrite')

  return (
    <div className="min-h-screen">
      <div className="container-page flex h-12 items-center gap-3 border-b border-ink-100 dark:border-ink-900">
        <Link
          href="/"
          className="text-sm font-semibold tracking-tight text-ink-900 dark:text-ink-50"
        >
          {siteName}
        </Link>
        <span className="text-xs text-ink-400 dark:text-ink-600">写作区</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
      {children}
    </div>
  )
}
