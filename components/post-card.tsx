import Link from 'next/link'
import type { PostSummary } from '@/lib/types'
import { formatDate } from '@/lib/format'
import { CommentIcon, EyeIcon } from './icons'
import { Badge } from './ui'

/** 文章列表项：整块可点击，标签/作者为独立链接 */
export function PostCard({ post }: { post: PostSummary }) {
  return (
    <article className="group relative border-b border-ink-100 last:border-0 dark:border-ink-800/70">
      <div className="py-6">
        <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
          <time dateTime={post.publishedAt ?? post.createdAt}>
            {formatDate(post.publishedAt ?? post.createdAt)}
          </time>
          <span aria-hidden="true">·</span>
          <span>{post.author.nickname}</span>
          {post.status === 'DRAFT' && <Badge className="border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-500">草稿</Badge>}
        </div>

        <h2 className="mt-2 text-lg font-semibold tracking-tight">
          <Link
            href={post.status === 'DRAFT' ? `/write/${post.slug}` : `/posts/${post.slug}`}
            className="text-ink-900 transition-colors group-hover:text-accent dark:text-ink-50"
          >
            {/* 覆盖整卡的点击热区 */}
            <span className="absolute inset-0" aria-hidden="true" />
            {post.title}
          </Link>
        </h2>

        {post.summary && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-ink-500 dark:text-ink-400">
            {post.summary}
          </p>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-ink-400 dark:text-ink-500">
          {post.tags.length > 0 && (
            <div className="relative z-10 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${encodeURIComponent(tag.slug)}`}
                  className="rounded border border-ink-200 px-1.5 py-0.5 text-2xs text-ink-500 transition-colors hover:border-accent/40 hover:text-accent dark:border-ink-700 dark:text-ink-400"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
          <div className="ml-auto flex items-center gap-3">
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5" />
              {post.views}
            </span>
            {typeof post.commentCount === 'number' && (
              <span className="inline-flex items-center gap-1">
                <CommentIcon className="h-3.5 w-3.5" />
                {post.commentCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
