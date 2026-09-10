import { getCurrentUser } from '@/lib/auth'
import Link from 'next/link'
import { postService } from '@/server/post-service'
import { tagService } from '@/server/tag-service'
import { PostEntry } from '@/components/post-entry'
import { formatDate } from '@/lib/format'
import { EmptyState, LinkButton, SectionLabel } from '@/components/ui'
import { page as pageParam, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

const RECENT_SIZE = 8

interface HomeProps {
  searchParams: PageSearchParams
}

/**
 * 首页 = 特写 + 近期文章。
 *
 * 与旧版最大的结构差异：不再有右侧边栏和卡片列表。
 * 首屏用一篇「特写」占据视觉重心（大号衬线标题 + 摘要 + 首字下沉），
 * 下面接一条紧凑的近期列表，标签只作为一行文字出现，不占版面。
 */
export default async function HomePage({ searchParams }: HomeProps) {
  const currentPage = pageParam(searchParams.page)

  const [featured, recent, topics] = await Promise.all([
    postService.list({ page: 1, pageSize: 1, status: 'PUBLISHED', sort: 'latest' }, null),
    postService.list(
      { page: currentPage, pageSize: RECENT_SIZE, status: 'PUBLISHED', sort: 'latest' },
      null,
    ),
    tagService.list(),
  ])

  const hero = currentPage === 1 ? featured.items[0] : undefined
  // 首页第一页时，列表跳过已作为特写展示的那篇，避免重复
  const entries = hero ? recent.items.slice(1) : recent.items
  const viewer = await getCurrentUser()

  return (
    <div className="shell">
      {hero && (
        <section className="border-b border-ink-line py-16 dark:border-night-line lg:py-24">
          <div className="grid gap-10 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <SectionLabel>本期特写</SectionLabel>
              <p className="meta mt-4">{formatDate(hero.publishedAt ?? hero.createdAt)}</p>
            </div>

            <div className="min-w-0 lg:col-span-8 lg:col-start-5">
              <h1 className="font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
                <Link
                  href={`/posts/${hero.slug}`}
                  className="text-ink-strong transition-colors hover:text-accent dark:text-white"
                >
                  {hero.title}
                </Link>
              </h1>

              {hero.summary && (
                <p className="dropcap mt-8 max-w-2xl font-sans text-base leading-relaxed text-ink-soft dark:text-ink-muted">
                  {hero.summary}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link
                  href={`/posts/${hero.slug}`}
                  className="link font-sans text-sm"
                >
                  阅读全文
                </Link>
                <span className="meta">{hero.author.nickname}</span>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="grid gap-10 py-16 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <SectionLabel>近期</SectionLabel>
          {recent.meta.total > 0 && (
            <p className="meta mt-4">共 {recent.meta.total} 篇</p>
          )}
        </div>

        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          {entries.length === 0 ? (
            <EmptyState
              title="还没有文章"
              description="登录后即可写下第一篇。"
              action={
                <LinkButton href="/write" variant="primary" size="sm">
                  开始写作
                </LinkButton>
              }
            />
          ) : (
            <>
              <div>
                {entries.map((post, index) => (
                  <PostEntry key={post.id} post={post} index={index} />
                ))}
              </div>
              <div className="mt-8">
                <Link href="/writing" className="link font-sans text-sm">
                  查看全部文章 →
                </Link>
              </div>
            </>
          )}
        </div>
      </section>

      {topics.length > 0 && (
        <section className="border-t border-ink-line py-12 dark:border-night-line">
          <div className="grid gap-6 lg:grid-cols-12">
            <div className="lg:col-span-3">
              <SectionLabel>主题</SectionLabel>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-3 lg:col-span-8 lg:col-start-5">
              {topics.slice(0, 14).map((topic) => (
                <Link key={topic.id} href={`/topics/${encodeURIComponent(topic.slug)}`} className="tag">
                  {topic.name}
                  <span className="ml-1.5 text-ink-faint">{topic.postCount}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {!viewer && (
        <section className="border-t border-ink-line py-12 dark:border-night-line">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <p className="font-sans text-sm text-ink-soft dark:text-ink-muted">
              登录后可以发表评论与文章。
            </p>
            <div className="flex gap-3">
              <LinkButton href="/login" variant="primary" size="sm">
                登录
              </LinkButton>
              <LinkButton href="/register" size="sm">
                注册
              </LinkButton>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}
