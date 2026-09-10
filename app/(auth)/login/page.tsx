import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '登录',
  description: '登录后可以发表文章与评论',
}

export default async function LoginPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <AuthShell title="欢迎回来" subtitle="登录后可以发表文章与评论">
      <Suspense fallback={<div className="skeleton h-64 w-full rounded-lg" />}>
        <AuthForm mode="login" />
      </Suspense>
    </AuthShell>
  )
}
