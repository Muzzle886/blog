import Link from 'next/link'
import { getCurrentUser } from '@/lib/auth'
import { postService } from '@/server/post-service'
import { tagService } from '@/server/tag-service'
import { PostCard } from '@/components/post-card'
import { Pagination } from '@/components/pagination'
import { EmptyState, LinkButton } from '@/components/ui'
import { TagIcon } from '@/components/icons'

export const dynamic = 'force-dynamic'

const PAGE_SIZE = 8

interface HomeProps {
  searchParams: { page?: string; tag?: string }
}

export default async function HomePage({ searchParams }: HomeProps) {
  const page = Math.max(1, Number(searchParams.page) || 1)
  const tag = searchParams.tag

  const [viewer, { items, meta }, tags] = await Promise.all([
    getCurrentUser(),
    postService.list(
      { page, pageSize: PAGE_SIZE, status: 'PUBLISHED', sort: 'latest', tag },
      // 首页只展示已发布文章，登录态不影响过滤
      null,
    ),
    tagService.list(),
  ])

  const buildHref = (nextPage: number) => {
    const params = new URLSearchParams()
    if (tag) params.set('tag', tag)
    if (nextPage > 1) params.set('page', String(nextPage))
    const query = params.toString()
    return query ? `/?${query}` : '/'
  }

  return (
    <div className="container-page py-10">
      <section className="mb-10 max-w-prose">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          最新文章
        </h1>
        <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">
          关于工程实践、架构取舍与技术写作的记录。
          {meta.total > 0 && <> 共 {meta.total} 篇。</>}
        </p>
      </section>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_13rem]">
        <div>
          {tag && (
            <div className="mb-4 flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
              <TagIcon className="h-4 w-4" />
              正在筛选标签
              <span className="font-medium text-ink-800 dark:text-ink-200">
                #{tags.find((item) => item.slug === tag)?.name ?? tag}
              </span>
              <Link href="/" className="ml-1 text-accent hover:underline">
                清除
              </Link>
            </div>
          )}

          {items.length === 0 ? (
            <EmptyState
              title={tag ? '该标签下暂无文章' : '还没有发布任何文章'}
              description={
                tag ? '试试其他标签，或浏览全部文章。' : '登录后即可写下第一篇。'
              }
              action={
                tag ? (
                  <LinkButton href="/" size="sm">
                    查看全部
                  </LinkButton>
                ) : (
                  <LinkButton href="/write" size="sm" variant="primary">
                    开始写作
                  </LinkButton>
                )
              }
            />
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
                buildHref={buildHref}
                className="mt-10"
              />
            </>
          )}
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-20 space-y-6">
            <SidebarBlock title="常用标签">
              {tags.length === 0 ? (
                <p className="text-xs hint">暂无标签</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {tags.slice(0, 12).map((item) => (
                    <Link
                      key={item.id}
                      href={`/tags/${encodeURIComponent(item.slug)}`}
                      className="rounded border border-ink-200 px-2 py-1 text-2xs text-ink-600 transition-colors hover:border-accent/40 hover:text-accent dark:border-ink-700 dark:text-ink-400"
                    >
                      {item.name}
                      <span className="ml-1 text-ink-400 dark:text-ink-600">
                        {item.postCount}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </SidebarBlock>

            {viewer ? (
              <SidebarBlock title="快捷入口">
                <div className="flex flex-col gap-1.5">
                  <LinkButton href="/write" size="sm" variant="primary" className="w-full">
                    写新文章
                  </LinkButton>
                  <LinkButton href="/admin/posts" size="sm" className="w-full">
                    管理文章
                  </LinkButton>
                </div>
              </SidebarBlock>
            ) : (
              <SidebarBlock title="关于本站">
                <p className="text-xs leading-relaxed text-ink-500 dark:text-ink-400">
                  使用 Next.js App Router 与 Prisma 构建，
                  接口遵循 RESTful 规范。登录后可以发表评论与文章。
                </p>
                <div className="mt-3 flex gap-1.5">
                  <LinkButton href="/login" size="sm" variant="primary">
                    登录
                  </LinkButton>
                  <LinkButton href="/register" size="sm">
                    注册
                  </LinkButton>
                </div>
              </SidebarBlock>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function SidebarBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
        {title}
      </h2>
      {children}
    </div>
  )
}
