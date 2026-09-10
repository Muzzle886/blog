import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { AdminPostList } from '@/components/admin-post-list'
import { ArrowLeftIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '文章管理',
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
  const page = Math.max(1, Number(searchParams.page) || 1)

  // 服务层的可见性规则保证：普通用户只看得到自己的文章，管理员看全部
  const { items, meta } = await postService.list(
    { page, pageSize: PAGE_SIZE, status, sort: 'latest' },
    viewer,
  )

  return (
    <div className="container-page py-10">
      <Link
        href="/"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        返回首页
      </Link>

      <header className="mb-7">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          文章管理
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {viewer.role === 'ADMIN' ? '管理员视图：可见全部用户的文章' : '这里只显示你自己的文章'}
        </p>
      </header>

      <AdminPostList
        posts={items}
        total={meta.total}
        status={status}
        page={meta.page}
        totalPages={meta.totalPages}
        viewerId={viewer.id}
      />
    </div>
  )
}
