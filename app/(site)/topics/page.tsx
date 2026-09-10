import type { Metadata } from 'next'
import Link from 'next/link'
import { tagService } from '@/server/tag-service'
import { EmptyState, LinkButton, SectionLabel } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '主题',
  description: '按主题浏览全部文章',
}

/** 主题总览：按文章数排序，用排版权重体现热度，不用卡片网格 */
export default async function TopicsPage() {
  const topics = await tagService.list()
  const max = Math.max(1, ...topics.map((t) => t.postCount ?? 0))

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-14 dark:border-night-line">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>主题</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl sm:text-4xl">主题</h1>
            <p className="mt-4 max-w-xl font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
              {topics.length > 0 ? `共 ${topics.length} 个主题，` : ''}
              字号越大表示文章越多。
            </p>
          </div>
        </div>
      </header>

      <div className="py-12">
        {topics.length === 0 ? (
          <EmptyState
            title="还没有主题"
            description="主题会随文章的创建自动生成。"
            action={
              <LinkButton href="/write" variant="primary" size="sm">
                写第一篇
              </LinkButton>
            }
          />
        ) : (
          <ul className="flex flex-wrap items-baseline gap-x-8 gap-y-6">
            {topics.map((topic) => {
              // 用字号映射文章数：最多 3xl，最少 base
              const weight = (topic.postCount ?? 0) / max
              const size =
                weight > 0.75 ? 'text-3xl' : weight > 0.5 ? 'text-2xl' : weight > 0.25 ? 'text-xl' : 'text-base'
              return (
                <li key={topic.id}>
                  <Link
                    href={`/topics/${encodeURIComponent(topic.slug)}`}
                    className="group inline-flex items-baseline gap-2"
                  >
                    <span
                      className={`font-serif ${size} text-ink-strong transition-colors group-hover:text-accent dark:text-white`}
                    >
                      {topic.name}
                    </span>
                    <span className="font-mono text-xs text-ink-faint dark:text-ink-muted">
                      {topic.postCount}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
