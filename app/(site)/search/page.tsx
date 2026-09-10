import type { Metadata } from 'next'
import { Suspense } from 'react'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { PostCard } from '@/components/post-card'
import { Pagination } from '@/components/pagination'
import { SearchInput } from '@/components/search-input'
import { EmptyState, ListSkeleton } from '@/components/ui'
import { SearchIcon } from '@/components/icons'
import { page as pageParam, str, type PageSearchParams } from '@/lib/search-params'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '搜索',
  description: '搜索站点内的全部文章',
}

const PAGE_SIZE = 10

interface SearchPageProps {
  searchParams: PageSearchParams
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = str(searchParams.q)
  const page = pageParam(searchParams.page)

  return (
    <div className="container-narrow py-10">
      <header className="mb-8">
        <h1 className="mb-4 text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          搜索
        </h1>
        <Suspense fallback={<div className="skeleton h-11 w-full rounded-lg" />}>
          <SearchInput initialQuery={query} />
        </Suspense>
      </header>

      <Suspense fallback={<ListSkeleton />}>
        <SearchResults query={query} page={page} />
      </Suspense>
    </div>
  )
}

async function SearchResults({ query, page }: { query: string; page: number }) {
  if (!query) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 px-6 py-16 text-center dark:border-ink-800">
        <SearchIcon className="h-7 w-7 text-ink-300 dark:text-ink-600" />
        <p className="mt-3 text-sm text-ink-500 dark:text-ink-400">
          输入关键词开始搜索
        </p>
        <p className="mt-1 text-xs hint">支持标题、摘要与正文全文匹配</p>
      </div>
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
      <p className="mb-4 text-sm text-ink-500 dark:text-ink-400">
        找到 <span className="font-medium text-ink-800 dark:text-ink-200">{meta.total}</span> 篇与
        「{query}」相关的文章
      </p>
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
            ? `/search?q=${encodeURIComponent(query)}&page=${nextPage}`
            : `/search?q=${encodeURIComponent(query)}`
        }
        className="mt-10"
      />
    </>
  )
}
