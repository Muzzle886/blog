import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { tagService } from '@/server/tag-service'
import { postService } from '@/server/post-service'
import { PostCard } from '@/components/post-card'
import { Pagination } from '@/components/pagination'
import { ArrowLeftIcon } from '@/components/icons'
import { EmptyState } from '@/components/ui'
import { page as pageParam, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 10

interface TagPageProps {
  params: { slug: string }
  searchParams: PageSearchParams
}

export async function generateMetadata({ params }: TagPageProps): Promise<Metadata> {
  try {
    const tag = await tagService.getBySlug(decodeURIComponent(params.slug))
    return { title: `#${tag.name}`, description: `标签 ${tag.name} 下的全部文章` }
  } catch {
    return { title: '标签不存在' }
  }
}

export default async function TagDetailPage({ params, searchParams }: TagPageProps) {
  const slug = decodeURIComponent(params.slug)
  const page = pageParam(searchParams.page)

  let tag
  try {
    tag = await tagService.getBySlug(slug)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }

  const viewer = await getCurrentUser()
  const { items, meta } = await postService.list(
    { page, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', tag: slug },
    viewer,
  )

  return (
    <div className="container-narrow py-10">
      <Link
        href="/tags"
        className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        全部标签
      </Link>

      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          #{tag.name}
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{meta.total} 篇文章</p>
      </header>

      {items.length === 0 ? (
        <EmptyState title="该标签下暂无文章" description="可能文章还在草稿状态。" />
      ) : (
        <>
          <div>
            {items.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            buildHref={(nextPage) =>
              nextPage > 1
                ? `/tags/${encodeURIComponent(slug)}?page=${nextPage}`
                : `/tags/${encodeURIComponent(slug)}`
            }
            className="mt-10"
          />
        </>
      )}
    </div>
  )
}
