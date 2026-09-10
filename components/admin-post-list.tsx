'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PostSummary } from '@/lib/types'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { Button, EmptyState, LinkButton, Select } from '@/components/ui'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useToast } from '@/components/ui/toast'

interface AdminPostListProps {
  posts: PostSummary[]
  total: number
  status: string
  page: number
  totalPages: number
  viewerId: number
}

/**
 * 文章管理列表。
 * 与前台列表同一套排版语言：一条细分隔线 + 衬线标题，
 * 状态/数据压成小字；操作项默认隐藏，hover 才出现。
 */
export function AdminPostList({
  posts: initialPosts,
  total,
  status,
  page,
  totalPages,
  viewerId,
}: AdminPostListProps) {
  const router = useRouter()
  const toast = useToast()
  const [posts, setPosts] = useState(initialPosts)
  const [pending, setPending] = useState<PostSummary | null>(null)
  const [deleting, setDeleting] = useState(false)

  async function confirmDelete() {
    if (!pending) return
    setDeleting(true)
    try {
      await api.del(`/api/posts/${pending.slug}`)
      setPosts((prev) => prev.filter((post) => post.id !== pending.id))
      setPending(null)
      toast.success('文章已删除')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-6 pb-8">
        <label className="flex items-center gap-3">
          <span className="eyebrow">状态</span>
          <Select
            value={status}
            onChange={(event) => {
              const value = event.target.value
              router.push(value === 'ALL' ? '/admin/posts' : `/admin/posts?status=${value}`)
            }}
            className="w-32 py-1 text-sm"
            aria-label="筛选状态"
          >
            <option value="ALL">全部</option>
            <option value="PUBLISHED">已发布</option>
            <option value="DRAFT">草稿</option>
          </Select>
        </label>

        <p className="meta">
          共 {total} 篇
        </p>

        <LinkButton href="/write" size="sm" variant="primary" className="ml-auto">
          写新文章
        </LinkButton>
      </div>

      {posts.length === 0 ? (
        <EmptyState
          title="这里还没有文章"
          description="写完第一篇后，它会出现在这里方便管理。"
          action={
            <LinkButton href="/write" size="sm" variant="primary">
              开始写作
            </LinkButton>
          }
        />
      ) : (
        <ul>
          {posts.map((post) => (
            <li
              key={post.id}
              className="group border-t border-ink-line py-6 dark:border-night-line"
            >
              <div className="flex items-baseline gap-4">
                <span className="meta w-24 shrink-0">
                  {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                </span>

                <div className="min-w-0 flex-1">
                  <h3 className="font-serif text-lg leading-snug">
                    <Link
                      href={post.status === 'PUBLISHED' ? `/posts/${post.slug}` : `/write/${post.slug}`}
                      className="text-ink-strong transition-colors hover:text-accent dark:text-white"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <span className="meta">
                      {post.status === 'PUBLISHED'
                        ? `发布于 ${formatDate(post.publishedAt)}`
                        : `更新于 ${formatDate(post.updatedAt)}`}
                    </span>
                    <span className="meta">{post.views} 次阅读</span>
                    <span className="meta">{post.commentCount ?? 0} 条评论</span>
                    {post.author.id !== viewerId && (
                      <span className="meta">协作者 {post.author.nickname}</span>
                    )}
                  </div>
                </div>

                <div className="flex shrink-0 items-baseline gap-4 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                  <Link href={`/write/${post.slug}`} className="tag">
                    编辑
                  </Link>
                  <button
                    type="button"
                    onClick={() => setPending(post)}
                    className="font-sans text-xs text-ink-faint transition-colors hover:text-red-700 dark:hover:text-red-400"
                  >
                    删除
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-between border-t border-ink-line pt-6 dark:border-night-line">
          {page > 1 ? (
            <Link href={`/admin/posts?${buildQuery(status, page - 1)}`} className="nav-item">
              ← 上一页
            </Link>
          ) : (
            <span className="font-sans text-sm text-ink-faint/60 dark:text-ink-muted/50">← 上一页</span>
          )}
          <span className="font-mono text-xs text-ink-faint dark:text-ink-muted">
            {page} / {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={`/admin/posts?${buildQuery(status, page + 1)}`} className="nav-item">
              下一页 →
            </Link>
          ) : (
            <span className="font-sans text-sm text-ink-faint/60 dark:text-ink-muted/50">下一页 →</span>
          )}
        </nav>
      )}

      <ConfirmDialog
        open={pending !== null}
        title="删除这篇文章？"
        description={
          pending?.status === 'PUBLISHED'
            ? '删除后前台将无法访问，作者与管理员仍可在数据库中恢复。'
            : '草稿删除后不可恢复。'
        }
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPending(null)}
      />
    </div>
  )
}

function buildQuery(status: string, page: number): string {
  const params = new URLSearchParams()
  if (status !== 'ALL') params.set('status', status)
  if (page > 1) params.set('page', String(page))
  return params.toString()
}
