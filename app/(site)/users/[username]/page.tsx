import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { userService } from '@/server/user-service'
import { postService } from '@/server/post-service'
import { PostCard } from '@/components/post-card'
import { EmptyState } from '@/components/ui'
import { CalendarIcon } from '@/components/icons'
import { page as pageParam, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: { username: string }
  searchParams: PageSearchParams
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  try {
    const { user, postCount } = await userService.getProfileByUsername(params.username)
    return {
      title: user.nickname,
      description: `${user.nickname} 的文章，共 ${postCount} 篇`,
    }
  } catch {
    return { title: '用户不存在' }
  }
}

const PAGE_SIZE = 10

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const page = pageParam(searchParams.page)

  let profile
  try {
    profile = await userService.getProfileByUsername(params.username)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }

  const { user, postCount } = profile
  const { items, meta } = await postService.list(
    { page, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', author: user.username },
    null,
  )

  return (
    <div className="container-narrow py-10">
      <header className="mb-10 flex items-start gap-5">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-ink-900 text-lg font-semibold text-white dark:bg-ink-100 dark:text-ink-900">
          {user.nickname.slice(0, 1).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
            {user.nickname}
          </h1>
          <p className="mt-0.5 text-sm text-ink-400 dark:text-ink-500">@{user.username}</p>
          {user.bio && (
            <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-600 dark:text-ink-400">
              {user.bio}
            </p>
          )}
          <div className="mt-3 flex items-center gap-4 text-xs text-ink-400 dark:text-ink-500">
            <span>{postCount} 篇文章</span>
            <span className="inline-flex items-center gap-1">
              <CalendarIcon className="h-3.5 w-3.5" />
              加入于 {formatDate(user.createdAt)}
            </span>
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState title="还没有公开的文章" />
      ) : (
        <div>
          {items.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
          {meta.totalPages > 1 && (
            <p className="mt-8 text-center text-xs hint">
              第 {meta.page} / {meta.totalPages} 页 · 共 {meta.total} 篇
            </p>
          )}
        </div>
      )}
    </div>
  )
}
