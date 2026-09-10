'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { PostSummary } from '@/lib/types'
import { api } from '@/lib/api-client'
import { formatDate } from '@/lib/format'
import { PenIcon, TrashIcon } from '@/components/icons'
import { Badge, EmptyState, LinkButton, Select } from '@/components/ui'
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
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <Select
          value={status}
          onChange={(event) => {
            const value = event.target.value
            router.push(value === 'ALL' ? '/admin/posts' : `/admin/posts?status=${value}`)
          }}
          className="w-36"
          aria-label="筛选状态"
        >
          <option value="ALL">全部状态</option>
          <option value="PUBLISHED">已发布</option>
          <option value="DRAFT">草稿</option>
        </Select>

        <p className="text-sm text-ink-500 dark:text-ink-400">
          共 <span className="font-medium text-ink-800 dark:text-ink-200">{total}</span> 篇
        </p>

        <LinkButton href="/write" size="sm" variant="primary" className="ml-auto">
          <PenIcon className="h-3.5 w-3.5" />
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
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {posts.map((post) => (
            <li key={post.id} className="group flex items-center gap-4 py-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    className={
                      post.status === 'PUBLISHED'
                        ? 'border-emerald-300 text-emerald-700 dark:border-emerald-800 dark:text-emerald-500'
                        : 'border-amber-300 text-amber-700 dark:border-amber-800 dark:text-amber-500'
                    }
                  >
                    {post.status === 'PUBLISHED' ? '已发布' : '草稿'}
                  </Badge>
                  {post.author.id !== viewerId && (
                    <Badge>协作者 · {post.author.nickname}</Badge>
                  )}
                  <Link
                    href={
                      post.status === 'PUBLISHED' ? `/posts/${post.slug}` : `/write/${post.slug}`
                    }
                    className="truncate text-sm font-medium text-ink-900 transition-colors hover:text-accent dark:text-ink-100"
                  >
                    {post.title}
                  </Link>
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-400 dark:text-ink-500">
                  <span>
                    {post.status === 'PUBLISHED'
                      ? `发布于 ${formatDate(post.publishedAt)}`
                      : `更新于 ${formatDate(post.updatedAt)}`}
                  </span>
                  <span>{post.views} 次阅读</span>
                  <span>{post.commentCount ?? 0} 条评论</span>
                  {post.tags.length > 0 && <span>{post.tags.map((tag) => tag.name).join(' · ')}</span>}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-1">
                <LinkButton href={`/write/${post.slug}`} size="sm">
                  编辑
                </LinkButton>
                <button
                  type="button"
                  onClick={() => setPending(post)}
                  aria-label={`删除 ${post.title}`}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/40 dark:hover:text-red-400"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {totalPages > 1 && (
        <div className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link
              href={`/admin/posts?${buildQuery(status, page - 1)}`}
              className="nav-link"
            >
              上一页
            </Link>
          )}
          <span className="text-xs hint">
            第 {page} / {totalPages} 页
          </span>
          {page < totalPages && (
            <Link
              href={`/admin/posts?${buildQuery(status, page + 1)}`}
              className="nav-link"
            >
              下一页
            </Link>
          )}
        </div>
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
