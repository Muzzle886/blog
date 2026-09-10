import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { SettingsForm } from '@/components/settings-form'
import { SectionLabel } from '@/components/ui'
import { formatDate } from '@/lib/format'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '账号设置',
}

export default async function SettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fsettings')

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>账号</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">设置</h1>
            <p className="meta mt-3">
              @{user.username} · 加入于 {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-12 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <SettingsForm user={user} />
        </div>
      </div>
    </div>
  )
}
