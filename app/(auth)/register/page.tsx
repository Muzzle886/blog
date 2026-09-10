import type { Metadata } from 'next'
import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AuthForm } from '@/components/auth-form'
import { AuthShell } from '@/components/auth-shell'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '注册',
  description: '创建账号，开始写作',
}

export default async function RegisterPage() {
  const user = await getCurrentUser()
  if (user) redirect('/')

  return (
    <AuthShell title="创建账号" subtitle="注册后自动登录，第一个注册的用户将成为管理员">
      <Suspense fallback={<div className="skeleton h-80 w-full rounded-sm" />}>
        <AuthForm mode="register" />
      </Suspense>
    </AuthShell>
  )
}
