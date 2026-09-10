import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { AdminPostList } from '@/components/admin-post-list'
import { SectionLabel } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '我的文章',
}

const PAGE_SIZE = 15

interface AdminPostsPageProps {
  searchParams: { status?: string; page?: string }
}

export default async function AdminPostsPage({ searchParams }: AdminPostsPageProps) {
  const viewer = await getCurrentUser()
  if (!viewer) redirect('/login?redirect=%2Fadmin%2Fposts')

  const status = ['PUBLISHED', 'DRAFT', 'ALL'].includes(searchParams.status ?? '')
    ? (searchParams.status as 'PUBLISHED' | 'DRAFT' | 'ALL')
    : 'ALL'
  const rawPage = Number(searchParams.page)
  const page = Number.isFinite(rawPage) && rawPage >= 1 ? Math.trunc(rawPage) : 1

  // 服务层的可见性规则保证：普通用户只看得到自己的文章，管理员看全部
  const { items, meta } = await postService.list(
    { page, pageSize: PAGE_SIZE, status, sort: 'latest' },
    viewer,
  )

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>管理</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">我的文章</h1>
            <p className="meta mt-3">
              {viewer.role === 'ADMIN' ? '管理员视图：可见全部用户的文章' : '这里只显示你自己的文章'}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <AdminPostList
            posts={items}
            total={meta.total}
            status={status}
            page={meta.page}
            totalPages={meta.totalPages}
            viewerId={viewer.id}
          />
        </div>
      </div>
    </div>
  )
}
