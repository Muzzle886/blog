'use client'

import Link from 'next/link'
import { useState } from 'react'
import type { CommentItem, CursorMeta, PublicUser } from '@/lib/types'
import { api } from '@/lib/api-client'
import { formatRelative } from '@/lib/format'
import { Button, LinkButton, SectionLabel, Spinner, Textarea } from './ui'
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

/**
 * 评论区。
 * 视觉上不再用「卡片 + 回复框」的堆叠，而是：
 * 评论之间用细分隔线，作者名与时间压成一行小字，
 * 操作项（回复/删除）默认隐藏，hover 才出现。
 */
export function CommentSection({
  slug,
  viewer,
  initialComments,
  initialMeta,
  limit,
  postAuthorId,
}: CommentSectionProps) {
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

  async function submitRoot(event: React.FormEvent) {
    event.preventDefault()
    const text = content.trim()
    if (!text) return
    setSubmitting(true)
    try {
      const comment = await api.post<CommentItem>(`/api/posts/${slug}/comments`, { content: text })
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
          item.id === parentId || item.replies.some((r) => r.id === parentId)
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
    (viewer.id === comment.author.id || viewer.id === postAuthorId || viewer.role === 'ADMIN')

  return (
    <section id="comments" className="mt-16">
      <div className="flex items-baseline justify-between">
        <SectionLabel>评论</SectionLabel>
        {meta.total > 0 && <span className="meta">{meta.total} 条</span>}
      </div>

      <div className="mt-6">
        {viewer ? (
          <form onSubmit={submitRoot}>
            <Textarea
              value={content}
              onChange={(event) => setContent(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="写下你的看法…"
              disabled={submitting}
            />
            <div className="mt-3 flex items-center justify-between">
              <span className="meta">{content.length} / 1000</span>
              <Button
                type="submit"
                size="sm"
                variant="primary"
                disabled={submitting || content.trim().length === 0}
              >
                {submitting && <Spinner />}
                发表
              </Button>
            </div>
          </form>
        ) : (
          <div className="border-t border-ink-line py-6 dark:border-night-line">
            <p className="font-sans text-sm text-ink-soft dark:text-ink-muted">
              登录后可以参与讨论。
            </p>
            <div className="mt-4 flex gap-3">
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

      {comments.length === 0 ? (
        <p className="mt-10 font-sans text-sm text-ink-faint dark:text-ink-muted">
          还没有评论。
        </p>
      ) : (
        <ul className="mt-10">
          {comments.map((comment) => (
            <li key={comment.id} className="border-t border-ink-line py-6 dark:border-night-line">
              <CommentBody
                comment={comment}
                canModerate={canModerate(comment)}
                onReply={() => {
                  setReplyTo(replyTo === comment.id ? null : comment.id)
                  setReplyContent('')
                }}
                onDelete={() => setPendingDelete(comment)}
              />

              {comment.replies.length > 0 && (
                <ul className="mt-5 space-y-5 border-l border-ink-line pl-5 dark:border-night-line">
                  {comment.replies.map((reply) => (
                    <li key={reply.id}>
                      <CommentBody
                        comment={reply}
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
                <div className="mt-4 pl-5">
                  <Textarea
                    autoFocus
                    value={replyContent}
                    onChange={(event) => setReplyContent(event.target.value)}
                    rows={2}
                    maxLength={1000}
                    placeholder={`回复 ${comment.author.nickname}…`}
                    disabled={replySubmitting}
                  />
                  <div className="mt-3 flex justify-end gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)}>
                      取消
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      disabled={replySubmitting || replyContent.trim().length === 0}
                      onClick={() => submitReply(comment.id)}
                    >
                      {replySubmitting && <Spinner />}
                      回复
                    </Button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {meta.hasMore && (
        <div className="mt-8 border-t border-ink-line pt-6 dark:border-night-line">
          <Button size="sm" variant="ghost" onClick={loadMore} disabled={loadingMore}>
            {loadingMore && <Spinner />}
            加载更早的评论
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
  canModerate,
  onReply,
  onDelete,
}: {
  comment: CommentItem
  canModerate: boolean
  onReply: () => void
  onDelete: () => void
}) {
  return (
    <div className="group">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <Link
          href={`/users/${comment.author.username}`}
          className="font-sans text-sm font-medium text-ink-strong transition-colors hover:text-accent dark:text-white"
        >
          {comment.author.nickname}
        </Link>
        <time className="meta" dateTime={comment.createdAt}>
          {formatRelative(comment.createdAt)}
        </time>

        {/* 操作项默认不显示，hover 或键盘聚焦时出现 */}
        <span className="ml-auto flex gap-3 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
          <button type="button" onClick={onReply} className="tag">
            回复
          </button>
          {canModerate && (
            <button
              type="button"
              onClick={onDelete}
              className="font-sans text-xs text-ink-faint transition-colors hover:text-red-700 dark:hover:text-red-400"
            >
              删除
            </button>
          )}
        </span>
      </div>

      <p className="mt-2.5 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
        {comment.content}
      </p>
    </div>
  )
}
