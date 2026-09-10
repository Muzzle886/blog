import type { Metadata } from 'next'
import Link from 'next/link'
import { postService } from '@/server/post-service'
import { SectionLabel, EmptyState } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '时间线',
  description: '按时间浏览全部文章',
}

/**
 * 时间线。
 * 与旧版「归档」的区别：不再是「年-月标题 + 链接列表」的堆叠，
 * 而是一条连续的纵向时间轴，左侧是年份刻度，右侧是文章。
 */
export default async function TimelinePage() {
  const groups = await postService.archive()
  const total = groups.reduce((sum, group) => sum + group.count, 0)

  const byYear = new Map<number, typeof groups>()
  for (const group of groups) {
    const list = byYear.get(group.year) ?? []
    list.push(group)
    byYear.set(group.year, list)
  }

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>时间线</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">时间线</h1>
            <p className="mt-4 font-sans text-sm text-ink-soft dark:text-ink-muted">
              {byYear.size > 0
                ? `${total} 篇文章，横跨 ${byYear.size} 年`
                : '暂无文章'}
            </p>
          </div>
        </div>
      </header>

      {byYear.size === 0 ? (
        <EmptyState title="还没有已发布的文章" />
      ) : (
        <div className="py-12">
          {Array.from(byYear.entries()).map(([year, months]) => (
            <section key={year} className="grid gap-6 pb-14 lg:grid-cols-12">
              <div className="lg:col-span-3">
                <h2 className="font-serif text-2xl text-ink-strong dark:text-white">{year}</h2>
                <p className="meta mt-1">
                  {months.reduce((sum, m) => sum + m.count, 0)} 篇
                </p>
              </div>

              <div className="min-w-0 lg:col-span-8 lg:col-start-5">
                <div className="border-l border-ink-line pl-6 dark:border-night-line">
                  {months.map((month) => (
                    <div key={month.month} className="pb-8 last:pb-0">
                      <p className="eyebrow">
                        {String(month.month).padStart(2, '0')} 月
                      </p>
                      <ul className="mt-3 space-y-3">
                        {month.posts.map((post) => (
                          <li key={post.id} className="flex items-baseline gap-4">
                            <span className="w-10 shrink-0 font-mono text-xs text-ink-faint dark:text-ink-muted">
                              {String(new Date(post.publishedAt ?? post.createdAt).getDate()).padStart(2, '0')}
                            </span>
                            <Link
                              href={`/posts/${post.slug}`}
                              className="font-sans text-sm text-ink-soft transition-colors hover:text-accent dark:text-ink-muted"
                            >
                              {post.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
