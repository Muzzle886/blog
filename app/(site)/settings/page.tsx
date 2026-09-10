import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SettingsForm } from '@/components/settings-form'
import { ArrowLeftIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '账号设置',
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fsettings')

  return (
    <div className="container-narrow py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        返回首页
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          账号设置
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          @{user.username} · 加入于 {new Date(user.createdAt).toLocaleDateString('zh-CN')}
        </p>
      </header>

      <SettingsForm user={user} />
    </div>
  )
}
