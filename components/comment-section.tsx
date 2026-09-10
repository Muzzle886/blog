'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import type { CommentItem, CursorMeta, PublicUser } from '@/lib/types'
import { api } from '@/lib/api-client'
import { formatRelative } from '@/lib/format'
import { CommentIcon, TrashIcon } from './icons'
import { Button, LinkButton, Spinner, Textarea } from './ui'
import { ConfirmDialog } from './ui/confirm-dialog'
import { useToast } from './ui/toast'

interface CommentSectionProps {
  slug: string
  viewer: PublicUser | null
  initialComments: CommentItem[]
  initialMeta: CursorMeta
  limit: number
  postAuthorId: number
}

export function CommentSection({
  slug,
  viewer,
  initialComments,
  initialMeta,
  limit,
  postAuthorId,
}: CommentSectionProps) {
  const router = useRouter()
  const toast = useToast()

  const [comments, setComments] = useState(initialComments)
  const [meta, setMeta] = useState(initialMeta)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [replyTo, setReplyTo] = useState<number | null>(null)
  const [replyContent, setReplyContent] = useState('')
  const [replySubmitting, setReplySubmitting] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<CommentItem | null>(null)
  const [deleting, setDeleting] = useState(false)

  const totalCount = meta.total

  async function submitRoot(event: React.FormEvent) {
    event.preventDefault()
    const text = content.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const comment = await api.post<CommentItem>(`/api/posts/${slug}/comments`, {
        content: text,
      })
      // 顶层评论按时间倒序，新评论插到最前
      setComments((prev) => [comment, ...prev])
      setMeta((prev) => ({ ...prev, total: prev.total + 1 }))
      setContent('')
      toast.success('评论已发布')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '评论发布失败')
    } finally {
      setSubmitting(false)
    }
  }

  async function submitReply(parentId: number) {
    const text = replyContent.trim()
    if (!text) return
    setReplySubmitting(true)
    try {
      const reply = await api.post<CommentItem>(`/api/posts/${slug}/comments`, {
        content: text,
        parentId,
      })
      setComments((prev) =>
        prev.map((item) =>
          item.id === parentId
            ? { ...item, replies: [...item.replies, reply] }
            : // 回复「回复」时后端会把 parentId 提升到顶层，这里同步到对应顶层评论
              item.replies.some((r) => r.id === parentId)
              ? { ...item, replies: [...item.replies, reply] }
              : item,
        ),
      )
      setMeta((prev) => ({ ...prev, total: prev.total + 1 }))
      setReplyContent('')
      setReplyTo(null)
      toast.success('回复已发布')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '回复失败')
    } finally {
      setReplySubmitting(false)
    }
  }

  async function loadMore() {
    if (!meta.nextCursor) return
    setLoadingMore(true)
    try {
      const { data, meta: responseMeta } = await api.getWithMeta<CommentItem[]>(
        `/api/posts/${slug}/comments?cursor=${meta.nextCursor}&limit=${limit}`,
      )
      setComments((prev) => [...prev, ...data])
      const cursor = responseMeta?.cursor as CursorMeta | undefined
      if (cursor) setMeta(cursor)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载失败')
    } finally {
      setLoadingMore(false)
    }
  }

  async function confirmDelete() {
    if (!pendingDelete) return
    setDeleting(true)
    try {
      await api.del(`/api/comments/${pendingDelete.id}`)
      // 删除顶层评论会连带隐藏其回复
      setComments((prev) =>
        prev
          .filter((item) => item.id !== pendingDelete.id)
          .map((item) => ({
            ...item,
            replies: item.replies.filter((reply) => reply.id !== pendingDelete.id),
          })),
      )
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      setPendingDelete(null)
      toast.success('评论已删除')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  const canModerate = (comment: CommentItem) =>
    viewer !== null &&
    (viewer.id === comment.author.id ||
      viewer.id === postAuthorId ||
      viewer.role === 'ADMIN')

  return (
    <section id="comments" className="mt-16 border-t border-ink-200 pt-10 dark:border-ink-800">
      <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900 dark:text-ink-50">
        <CommentIcon className="h-4 w-4 text-ink-400" />
        评论
        {totalCount > 0 && (
          <span className="text-sm font-normal text-ink-400 dark:text-ink-500">
            {totalCount}
          </span>
        )}
      </h2>

      <div className="mt-5">
        {viewer ? (
          <form onSubmit={submitRoot}>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder={`以 ${viewer.nickname} 的身份发表评论…`}
              disabled={submitting}
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="hint">{content.length} / 1000</span>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={submitting || content.trim().length === 0}
              >
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                发表评论
              </Button>
            </div>
          </form>
        ) : (
          <div className="flex items-center justify-between rounded-lg border border-ink-200 px-4 py-3 dark:border-ink-800">
            <p className="text-sm text-ink-500 dark:text-ink-400">登录后即可参与讨论</p>
            <div className="flex gap-1.5">
              <LinkButton
                href={`/login?redirect=${encodeURIComponent(`/posts/${slug}`)}`}
                size="sm"
                variant="primary"
              >
                登录
              </LinkButton>
              <LinkButton href="/register" size="sm">
                注册
              </LinkButton>
            </div>
          </div>
        )}
      </div>

      <div className="mt-8">
        {comments.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-400 dark:text-ink-500">
            还没有评论，来说点什么吧。
          </p>
        ) : (
          <ul className="space-y-6">
            {comments.map((comment) => (
              <li key={comment.id}>
                <CommentBody
                  comment={comment}
                  viewer={viewer}
                  canModerate={canModerate(comment)}
                  onReply={() => {
                    setReplyTo(replyTo === comment.id ? null : comment.id)
                    setReplyContent('')
                  }}
                  onDelete={() => setPendingDelete(comment)}
                />

                {comment.replies.length > 0 && (
                  <ul className="mt-4 space-y-4 border-l border-ink-200 pl-4 dark:border-ink-800">
                    {comment.replies.map((reply) => (
                      <li key={reply.id}>
                        <CommentBody
                          comment={reply}
                          viewer={viewer}
                          canModerate={canModerate(reply)}
                          onReply={() => {
                            setReplyTo(replyTo === reply.id ? null : reply.id)
                            setReplyContent('')
                          }}
                          onDelete={() => setPendingDelete(reply)}
                        />
                      </li>
                    ))}
                  </ul>
                )}

                {replyTo === comment.id && (
                  <div className="mt-3 pl-4">
                    <Textarea
                      autoFocus
                      value={replyContent}
                      onChange={(event) => setReplyContent(event.target.value)}
                      rows={2}
                      maxLength={1000}
                      placeholder={`回复 ${comment.author.nickname}…`}
                      disabled={replySubmitting}
                    />
                    <div className="mt-2 flex justify-end gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                        取消
                      </Button>
                      <Button
                        size="sm"
                        variant="primary"
                        disabled={replySubmitting || replyContent.trim().length === 0}
                        onClick={() => submitReply(comment.id)}
                      >
                        {replySubmitting && <Spinner className="h-3.5 w-3.5" />}
                        回复
                      </Button>
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {meta.hasMore && (
        <div className="mt-8 text-center">
          <Button size="sm" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Spinner className="h-3.5 w-3.5" />}
            加载更多评论
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="删除这条评论？"
        description={
          pendingDelete?.replies.length
            ? '该评论下的回复也会一并隐藏，此操作不可撤销。'
            : '删除后不可恢复。'
        }
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      />
    </section>
  )
}

function CommentBody({
  comment,
  viewer,
  canModerate,
  onReply,
  onDelete,
}: {
  comment: CommentItem
  viewer: PublicUser | null
  canModerate: boolean
  onReply: () => void
  onDelete: () => void
}) {
  return (
    <div className="group">
      <div className="flex items-center gap-2 text-xs text-ink-400 dark:text-ink-500">
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-ink-100 text-2xs font-semibold text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          {comment.author.nickname.slice(0, 1).toUpperCase()}
        </span>
        <Link
          href={`/users/${comment.author.username}`}
          className="font-medium text-ink-700 transition-colors hover:text-accent dark:text-ink-300"
        >
          {comment.author.nickname}
        </Link>
        <time dateTime={comment.createdAt}>{formatRelative(comment.createdAt)}</time>
      </div>

      <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-700 dark:text-ink-300">
        {comment.content}
      </p>

      <div className="mt-1.5 flex items-center gap-3 text-xs opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {viewer && (
          <button
            type="button"
            onClick={onReply}
            className="text-ink-400 transition-colors hover:text-accent dark:text-ink-500"
          >
            回复
          </button>
        )}
        {canModerate && (
          <button
            type="button"
            onClick={onDelete}
            className="inline-flex items-center gap-1 text-ink-400 transition-colors hover:text-red-600 dark:text-ink-500 dark:hover:text-red-400"
          >
            <TrashIcon className="h-3 w-3" />
            删除
          </button>
        )}
      </div>
    </div>
  )
}
