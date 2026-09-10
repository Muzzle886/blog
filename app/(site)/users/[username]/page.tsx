import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { AppError } from '@/lib/errors'
import { formatDate } from '@/lib/format'
import { userService } from '@/server/user-service'
import { postService } from '@/server/post-service'
import { PostEntry } from '@/components/post-entry'
import { EmptyState, SectionLabel } from '@/components/ui'
import { page as pageParam, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

interface ProfilePageProps {
  params: { username: string }
  searchParams: PageSearchParams
}

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  try {
    const { user, postCount } = await userService.getProfileByUsername(params.username)
    return { title: user.nickname, description: `${user.nickname} 的文章，共 ${postCount} 篇` }
  } catch {
    return { title: '用户不存在' }
  }
}

const PAGE_SIZE = 12

export default async function ProfilePage({ params, searchParams }: ProfilePageProps) {
  const currentPage = pageParam(searchParams.page)

  let profile
  try {
    profile = await userService.getProfileByUsername(params.username)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }

  const { user, postCount } = profile
  const { items, meta } = await postService.list(
    { page: currentPage, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', author: user.username },
    null,
  )

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>作者</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">{user.nickname}</h1>
            <p className="meta mt-2">@{user.username}</p>
            {user.bio && (
              <p className="mt-5 max-w-xl font-sans text-base leading-relaxed text-ink-soft dark:text-ink-muted">
                {user.bio}
              </p>
            )}
            <p className="meta mt-5">
              {postCount} 篇文章 · 加入于 {formatDate(user.createdAt)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          {items.length === 0 ? (
            <EmptyState title="还没有公开的文章" />
          ) : (
            <>
              <div>
                {items.map((post, index) => (
                  <PostEntry
                    key={post.id}
                    post={post}
                    index={(currentPage - 1) * PAGE_SIZE + index}
                  />
                ))}
              </div>
              {meta.totalPages > 1 && (
                <p className="mt-8 border-t border-ink-line pt-6 meta dark:border-night-line">
                  第 {meta.page} / {meta.totalPages} 页
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
