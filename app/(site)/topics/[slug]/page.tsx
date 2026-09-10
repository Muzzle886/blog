import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { tagService } from '@/server/tag-service'
import { postService } from '@/server/post-service'
import { PostEntry } from '@/components/post-entry'
import { Pagination } from '@/components/pagination'
import { EmptyState, SectionLabel } from '@/components/ui'
import { page as pageParam, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 12

interface TopicProps {
  params: { slug: string }
  searchParams: PageSearchParams
}

export async function generateMetadata({ params }: TopicProps): Promise<Metadata> {
  try {
    const topic = await tagService.getBySlug(decodeURIComponent(params.slug))
    return { title: topic.name, description: `主题「${topic.name}」下的全部文章` }
  } catch {
    return { title: '主题不存在' }
  }
}

export default async function TopicPage({ params, searchParams }: TopicProps) {
  const slug = decodeURIComponent(params.slug)
  const currentPage = pageParam(searchParams.page)

  let topic
  try {
    topic = await tagService.getBySlug(slug)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }

  const viewer = await getCurrentUser()
  const { items, meta } = await postService.list(
    { page: currentPage, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', tag: slug },
    viewer,
  )

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>主题</SectionLabel>
            <Link href="/topics" className="mt-4 block meta transition-colors hover:text-accent">
              ← 全部主题
            </Link>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">{topic.name}</h1>
            <p className="mt-4 font-sans text-sm text-ink-soft dark:text-ink-muted">
              共 {meta.total} 篇文章
            </p>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          {items.length === 0 ? (
            <EmptyState title="该主题下暂无文章" description="可能文章还在草稿状态。" />
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
              <Pagination
                page={meta.page}
                totalPages={meta.totalPages}
                buildHref={(next) =>
                  next > 1
                    ? `/topics/${encodeURIComponent(slug)}?page=${next}`
                    : `/topics/${encodeURIComponent(slug)}`
                }
              />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
