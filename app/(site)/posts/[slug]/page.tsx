import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getCurrentUser } from '@/lib/auth'
import { AppError } from '@/lib/errors'
import { estimateReadingMinutes } from '@/lib/markdown'
import { formatDate } from '@/lib/format'
import { postService } from '@/server/post-service'
import { commentService } from '@/server/comment-service'
import { CommentSection } from '@/components/comment-section'
import { SectionLabel } from '@/components/ui'

export const dynamic = 'force-dynamic'

const COMMENT_LIMIT = 20

interface PostPageProps {
  params: { slug: string }
}

async function loadPost(slug: string) {
  const viewer = await getCurrentUser()
  try {
    return await postService.getBySlug(slug, viewer)
  } catch (error) {
    if (error instanceof AppError && error.status === 404) notFound()
    throw error
  }
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const viewer = await getCurrentUser()
  try {
    const post = await postService.getBySlug(params.slug, viewer)
    return {
      title: post.title,
      description: post.summary,
      openGraph: { title: post.title, description: post.summary, type: 'article' },
    }
  } catch {
    return { title: '文章不存在' }
  }
}

/**
 * 文章页。
 *
 * 结构上最大的变化：不再是「居中单列 + 标题堆叠」，
 * 而是**非对称两栏** —— 左栏是窄的固定 meta（日期/作者/时长/主题），
 * 右栏是主阅读列。这是杂志排版的常见处理，让正文行宽始终保持舒适，
 * 同时把元信息从标题上方挪走，标题可以更大更干净。
 */
export default async function PostPage({ params }: PostPageProps) {
  const [post, viewer] = await Promise.all([loadPost(params.slug), getCurrentUser()])

  const { items: comments, meta: commentMeta } = await commentService.listByPostSlug(
    params.slug,
    { limit: COMMENT_LIMIT },
    viewer,
  )

  const isAuthor = viewer?.id === post.author.id
  const canEdit = isAuthor || viewer?.role === 'ADMIN'
  const readingMinutes = estimateReadingMinutes(post.content)

  return (
    <article className="shell">
      {/* ===== 文章头：左 meta / 右标题 ===== */}
      <header className="grid gap-8 border-b border-ink-line py-12 dark:border-night-line lg:grid-cols-12 lg:py-16">
        <div className="lg:col-span-3">
          <SectionLabel>{post.status === 'DRAFT' ? '草稿' : '文章'}</SectionLabel>

          {/* 窄栏的 meta 列表：小字、纵向排布，不抢标题的注意力 */}
          <dl className="mt-6 space-y-3">
            <MetaRow label="日期">
              <time dateTime={post.publishedAt ?? post.createdAt}>
                {formatDate(post.publishedAt ?? post.createdAt)}
              </time>
            </MetaRow>
            <MetaRow label="作者">
              <Link href={`/users/${post.author.username}`} className="transition-colors hover:text-accent">
                {post.author.nickname}
              </Link>
            </MetaRow>
            <MetaRow label="时长">约 {readingMinutes} 分钟</MetaRow>
            <MetaRow label="阅读">{post.views}</MetaRow>
            {post.tags.length > 0 && (
              <MetaRow label="主题">
                <span className="flex flex-wrap gap-x-2 gap-y-1">
                  {post.tags.map((tag) => (
                    <Link
                      key={tag.id}
                      href={`/topics/${encodeURIComponent(tag.slug)}`}
                      className="tag"
                    >
                      {tag.name}
                    </Link>
                  ))}
                </span>
              </MetaRow>
            )}
          </dl>

          {canEdit && (
            <Link href={`/write/${post.slug}`} className="mt-6 inline-block link font-sans text-xs">
              编辑此篇
            </Link>
          )}
        </div>

        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <h1 className="text-balance font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
            {post.title}
          </h1>
          {post.summary && (
            <p className="mt-6 max-w-2xl font-sans text-lg leading-relaxed text-ink-soft dark:text-ink-muted">
              {post.summary}
            </p>
          )}
        </div>
      </header>

      {/* ===== 正文：右侧阅读列 ===== */}
      <div className="grid gap-8 py-12 lg:grid-cols-12 lg:py-16">
        <div className="min-w-0 lg:col-span-8 lg:col-start-5">
          <div
            className="markdown-body reading"
            dangerouslySetInnerHTML={{ __html: post.html }}
          />

          {/* 文末导航 */}
          <div className="mt-16 border-t border-ink-line pt-8 dark:border-night-line">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <Link href="/writing" className="nav-item">
                ← 返回文章列表
              </Link>
              <Link
                href={`/users/${post.author.username}`}
                className="meta transition-colors hover:text-accent"
              >
                {post.author.nickname} 的其它文章
              </Link>
            </div>
          </div>

          <CommentSection
            slug={post.slug}
            viewer={viewer}
            initialComments={comments}
            initialMeta={commentMeta}
            limit={COMMENT_LIMIT}
            postAuthorId={post.author.id}
          />
        </div>
      </div>
    </article>
  )
}

/** 窄栏 meta 的一行：标签在左、值在右，用极小的字 */
function MetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="eyebrow">{label}</dt>
      <dd className="mt-1 font-sans text-sm text-ink-soft dark:text-ink-muted">{children}</dd>
    </div>
  )
}
