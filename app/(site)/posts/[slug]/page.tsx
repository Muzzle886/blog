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
import { ArrowLeftIcon, ClockIcon, EyeIcon } from '@/components/icons'
import { Badge } from '@/components/ui'

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

export default async function PostPage({ params }: PostPageProps) {
  const [post, viewer] = await Promise.all([
    loadPost(params.slug),
    getCurrentUser(),
  ])

  const { items: comments, meta: commentMeta } = await commentService.listByPostSlug(
    params.slug,
    { limit: COMMENT_LIMIT },
    viewer,
  )

  const isAuthor = viewer?.id === post.author.id
  const readingMinutes = estimateReadingMinutes(post.content)

  return (
    <div className="container-narrow py-10">
      <Link
        href="/"
        className="mb-8 inline-flex items-center gap-1.5 text-sm text-ink-500 transition-colors hover:text-ink-900 dark:text-ink-400 dark:hover:text-ink-100"
      >
        <ArrowLeftIcon className="h-4 w-4" />
        返回首页
      </Link>

      <article>
        <header className="mb-8 border-b border-ink-200 pb-6 dark:border-ink-800">
          <div className="flex flex-wrap items-center gap-2">
            {post.status === 'DRAFT' && (
              <Badge className="border-amber-300 text-amber-600 dark:border-amber-800 dark:text-amber-500">
                草稿
              </Badge>
            )}
            {(isAuthor || viewer?.role === 'ADMIN') && (
              <Link
                href={`/write/${post.slug}`}
                className="text-xs text-accent hover:underline"
              >
                编辑
              </Link>
            )}
          </div>

          <h1 className="mt-3 text-balance text-3xl font-semibold leading-tight tracking-tight text-ink-900 dark:text-ink-50">
            {post.title}
          </h1>

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-400 dark:text-ink-500">
            <Link
              href={`/users/${post.author.username}`}
              className="transition-colors hover:text-ink-700 dark:hover:text-ink-300"
            >
              {post.author.nickname}
            </Link>
            <span className="inline-flex items-center gap-1">
              <ClockIcon className="h-3.5 w-3.5" />
              <time dateTime={post.publishedAt ?? post.createdAt}>
                {formatDate(post.publishedAt ?? post.createdAt)}
              </time>
            </span>
            <span className="inline-flex items-center gap-1">
              <EyeIcon className="h-3.5 w-3.5" />
              {post.views} 次阅读
            </span>
            <span>约 {readingMinutes} 分钟</span>
          </div>

          {post.tags.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-1.5">
              {post.tags.map((tag) => (
                <Link
                  key={tag.id}
                  href={`/tags/${encodeURIComponent(tag.slug)}`}
                  className="rounded border border-ink-200 px-2 py-0.5 text-2xs text-ink-500 transition-colors hover:border-accent/40 hover:text-accent dark:border-ink-700 dark:text-ink-400"
                >
                  {tag.name}
                </Link>
              ))}
            </div>
          )}
        </header>

        {/* html 由 lib/markdown.ts 在服务端经 marked 渲染 + DOMPurify 清洗 */}
        <div className="markdown-body" dangerouslySetInnerHTML={{ __html: post.html }} />
      </article>

      <CommentSection
        slug={post.slug}
        viewer={viewer}
        initialComments={comments}
        initialMeta={commentMeta}
        limit={COMMENT_LIMIT}
        postAuthorId={post.author.id}
      />
    </div>
  )
}
