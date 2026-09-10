import Link from 'next/link'
import type { PostSummary } from '@/lib/types'
import { formatDate } from '@/lib/format'

/**
 * 文章条目。
 *
 * 这里刻意**没有卡片**：旧版把每条文章装进带边框的盒子里，
 * 一屏能看到的信息量很低。新版只用一条上边线做分隔，
 * 标题用衬线体放大，元信息压到极小 —— 靠字号对比建立层级，
 * 而不是靠容器。
 */
export function PostEntry({ post, index }: { post: PostSummary; index?: number }) {
  const href = post.status === 'DRAFT' ? `/write/${post.slug}` : `/posts/${post.slug}`
  const date = formatDate(post.publishedAt ?? post.createdAt)

  return (
    <article className="group relative border-t border-ink-line py-7 first:border-t-0 dark:border-night-line">
      <div className="flex items-baseline gap-4">
        {typeof index === 'number' && (
          <span className="hidden w-8 shrink-0 font-mono text-xs text-ink-faint sm:block dark:text-ink-muted">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <time className="meta" dateTime={post.publishedAt ?? post.createdAt}>
              {date}
            </time>
            {post.status === 'DRAFT' && <span className="eyebrow text-amber-700 dark:text-amber-500">草稿</span>}
            {post.tags.length > 0 && (
              <span className="meta relative z-10">
                {post.tags.map((tag, i) => (
                  <span key={tag.id}>
                    {i > 0 && <span className="mx-1.5 text-ink-faint">/</span>}
                    <Link
                      href={`/topics/${encodeURIComponent(tag.slug)}`}
                      className="transition-colors hover:text-accent"
                    >
                      {tag.name}
                    </Link>
                  </span>
                ))}
              </span>
            )}
          </div>

          <h3 className="mt-2 font-serif text-xl leading-snug transition-colors group-hover:text-accent sm:text-2xl">
            <Link href={href} className="text-ink-strong dark:text-white">
              {/* 覆盖整条的热区 */}
              <span className="absolute inset-0" aria-hidden="true" />
              {post.title}
            </Link>
          </h3>

          {post.summary && (
            <p className="mt-3 line-clamp-2 max-w-2xl font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
              {post.summary}
            </p>
          )}

          <div className="mt-3 flex items-center gap-4">
            <span className="meta">{post.author.nickname}</span>
            {post.views > 0 && <span className="meta">{post.views} 次阅读</span>}
          </div>
        </div>
      </div>
    </article>
  )
}
