import type { Metadata } from 'next'
import Link from 'next/link'
import { tagService } from '@/server/tag-service'
import { EmptyState, LinkButton } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '标签',
  description: '按主题浏览全部文章',
}

export default async function TagsPage() {
  const tags = await tagService.list()

  return (
    <div className="container-narrow py-10">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          标签
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          {tags.length > 0 ? `共 ${tags.length} 个标签` : '暂无标签'}
        </p>
      </header>

      {tags.length === 0 ? (
        <EmptyState
          title="还没有标签"
          description="标签会随文章的创建自动生成。"
          action={
            <LinkButton href="/write" size="sm" variant="primary">
              写第一篇
            </LinkButton>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tags.map((tag) => (
            <li key={tag.id}>
              <Link
                href={`/tags/${encodeURIComponent(tag.slug)}`}
                className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 transition-colors hover:border-ink-300 hover:bg-ink-50 dark:border-ink-800 dark:hover:border-ink-700 dark:hover:bg-ink-900"
              >
                <span className="text-sm font-medium text-ink-800 dark:text-ink-200">
                  {tag.name}
                </span>
                <span className="text-xs text-ink-400 dark:text-ink-500">
                  {tag.postCount} 篇
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
