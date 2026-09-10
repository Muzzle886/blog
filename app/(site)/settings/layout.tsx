import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

/**
 * 账号设置的鉴权层。
 * 放在 layout 而不是 page：App Router 中 layout 的 redirect 会在渲染前中断，
 * 未登录用户不会看到任何受保护内容。
 */
export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fsettings')
  return <>{children}</>
}
