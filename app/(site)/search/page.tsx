import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { PostEntry } from '@/components/post-entry'
import { Pagination } from '@/components/pagination'
import { SearchInput } from '@/components/search-input'
import { EmptyState, ListSkeleton, SectionLabel } from '@/components/ui'
import { page as pageParam, str, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '搜索',
  description: '搜索站点内的全部文章',
}

const PAGE_SIZE = 12

interface SearchPageProps {
  searchParams: PageSearchParams
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = str(searchParams.q)
  const currentPage = pageParam(searchParams.page)

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>检索</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">搜索</h1>
            <div className="mt-8">
              <Suspense fallback={<div className="skeleton h-10 w-full" />}>
                <SearchInput initialQuery={query} />
              </Suspense>
            </div>
          </div>
        </div>
      </header>

      <div className="grid gap-10 py-10 lg:grid-cols-12">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <Suspense fallback={<ListSkeleton />}>
            <SearchResults query={query} page={currentPage} />
          </Suspense>
        </div>
      </div>
    </div>
  )
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  if (!query) {
    return (
      <p className="border-t border-ink-line py-16 font-sans text-sm text-ink-faint dark:border-night-line dark:text-ink-muted">
        输入关键词开始检索，按 <kbd className="font-mono text-xs">/</kbd> 可快速聚焦。
      </p>
    )
  }

  const viewer = await getCurrentUser()
  const { items, meta } = await postService.list(
    { page, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', q: query },
    viewer,
  )

  if (items.length === 0) {
    return (
      <EmptyState
        title={`没有找到与「${query}」相关的文章`}
        description="试试更短的关键词，或换个说法。"
      />
    )
  }

  return (
    <>
      <p className="meta pb-6">
        找到 {meta.total} 篇与「{query}」相关的文章
      </p>
      <div>
        {items.map((post, index) => (
          <PostEntry key={post.id} post={post} index={(page - 1) * PAGE_SIZE + index} />
        ))}
      </div>
      <Pagination
        page={meta.page}
        totalPages={meta.totalPages}
        buildHref={(next) =>
          next > 1
            ? `/search?q=${encodeURIComponent(query)}&page=${next}`
            : `/search?q=${encodeURIComponent(query)}`
        }
      />
    </>
  )
}
