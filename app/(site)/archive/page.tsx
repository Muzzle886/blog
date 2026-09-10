import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { EmptyState } from '@/components/ui'
import { CalendarIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '归档',
  description: '按时间浏览全部文章',
}

export default async function ArchivePage() {
  const viewer = await getCurrentUser()
  const groups = await postService.archive()
  const total = groups.reduce((sum, group) => sum + group.count, 0)

  return (
    <div className="container-narrow py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          归档
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {groups.length > 0
            ? `共 ${total} 篇文章，跨度 ${groups.length} 个月`
            : '暂无文章'}
        </p>
      </header>

      {groups.length === 0 ? (
        <EmptyState title="还没有已发布的文章" />
      ) : (
        <div className="space-y-10">
          {groups.map((group) => (
            <section key={`${group.year}-${group.month}`}>
              <h2 className="mb-4 flex items-baseline gap-3">
                <span className="text-lg font-semibold text-ink-900 dark:text-ink-50">
                  {group.year} 年 {group.month} 月
                </span>
                <span className="text-xs text-ink-400 dark:text-ink-500">
                  {group.count} 篇
                </span>
              </h2>

              <ul className="space-y-1">
                {group.posts.map((post) => (
                  <li key={post.id}>
                    <Link
                      href={`/posts/${post.slug}`}
                      className="group flex items-baseline gap-3 rounded-md px-2 py-2 transition-colors hover:bg-ink-50 dark:hover:bg-ink-900"
                    >
                      <CalendarIcon className="h-3.5 w-3.5 shrink-0 translate-y-0.5 text-ink-300 dark:text-ink-600" />
                      <span className="text-xs tabular-nums text-ink-400 dark:text-ink-500">
                        {String(new Date(post.publishedAt ?? post.createdAt).getDate()).padStart(2, '0')} 日
                      </span>
                      <span className="flex-1 text-sm text-ink-700 transition-colors group-hover:text-accent dark:text-ink-300">
                        {post.title}
                      </span>
                      {post.tags.length > 0 && (
                        <span className="hidden shrink-0 text-xs text-ink-400 sm:block dark:text-ink-500">
                          {post.tags.map((tag) => tag.name).join(' · ')}
                        </span>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {!viewer && (
        <p className="mt-12 text-center text-xs hint">
          归档仅包含已发布文章。
        </p>
      )}
    </div>
  )
}
