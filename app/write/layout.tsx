import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { ThemeToggle } from '@/components/theme-toggle'
import { UserMenu } from '@/components/user-menu'

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"

/** 写作区外壳：极简报头，把屏幕让给编辑区 */
export default async function WriteLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fwrite')

  return (
    <div className="min-h-screen">
      <div className="shell flex h-14 items-center gap-4 border-b border-ink-line dark:border-night-line">
        <Link
          href="/"
          className="font-serif text-base tracking-tight text-ink-strong transition-colors hover:text-accent dark:text-white"
        >
          {siteName}
        </Link>
        <span className="eyebrow">写作</span>
        <div className="ml-auto flex items-center gap-1">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
      {children}
    </div>
  )
}
