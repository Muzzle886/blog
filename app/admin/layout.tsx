import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'

/** 文章管理区的鉴权层，未登录直接中断渲染 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()
  if (!user) redirect('/login?redirect=%2Fadmin%2Fposts')
  return <>{children}</>
}
