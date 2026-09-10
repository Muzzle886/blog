import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { tagService } from '@/server/tag-service'
import { PostEntry } from '@/components/post-entry'
import { Pagination } from '@/components/pagination'
import { EmptyState, LinkButton, SectionLabel } from '@/components/ui'
import { page as pageParam, optionalStr, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '文章',
  description: '全部文章的完整索引',
}

const PAGE_SIZE = 12

interface WritingProps {
  searchParams: PageSearchParams
}

/** 文章总览：一条连续的时间序列表，没有分页盒子、没有侧栏 */
export default async function WritingPage({ searchParams }: WritingProps) {
  const currentPage = pageParam(searchParams.page)
  const topic = optionalStr(searchParams.topic)

  const [{ items, meta }, topics] = await Promise.all([
    postService.list(
      { page: currentPage, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', tag: topic },
      null,
    ),
    tagService.list(),
  ])

  const buildHref = (next: number) => {
    const params = new URLSearchParams()
    if (topic) params.set('topic', topic)
    if (next > 1) params.set('page', String(next))
    const q = params.toString()
    return q ? `/writing?${q}` : '/writing'
  }

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>索引</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">文章</h1>
            <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
              按时间倒序排列的全部文章。共 {meta.total} 篇。
            </p>
          </div>
        </div>
      </header>

      {topics.length > 0 && (
        <div className="grid gap-4 border-b border-ink-line py-6 dark:border-night-line lg:grid-cols-12">
          <div className="lg:col-span-3">
            <span className="eyebrow">按主题</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 lg:col-span-8 lg:col-start-5">
            <Link href="/writing" className={topic ? 'tag' : 'tag text-accent'}>
              全部
            </Link>
            {topics.map((item) => (
              <Link
                key={item.id}
                href={`/writing?topic=${encodeURIComponent(item.slug)}`}
                className={topic === item.slug ? 'tag text-accent' : 'tag'}
              >
                {item.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          {items.length === 0 ? (
            <EmptyState
              title="这个主题下还没有文章"
              description="换个主题，或者浏览全部文章。"
              action={
                <LinkButton href="/writing" size="sm">
                  查看全部
                </LinkButton>
              }
            />
          ) : (
            <>
              <div>
                {items.map((post, index) => (
                  <PostEntry key={post.id} post={post} index={(currentPage - 1) * PAGE_SIZE + index} />
                ))}
              </div>
              <Pagination page={meta.page} totalPages={meta.totalPages} buildHref={buildHref} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

