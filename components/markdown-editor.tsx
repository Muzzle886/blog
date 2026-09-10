'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PostDetail, PostStatus } from '@/lib/types'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { estimateReadingMinutes, extractSummary } from '@/lib/editor-utils'
import { Button, Spinner } from './ui'
import { ConfirmDialog } from './ui/confirm-dialog'
import { useToast } from './ui/toast'

// 预览依赖 highlight.js / DOMPurify，只在客户端加载
const MarkdownPreview = dynamic(
  () => import('./markdown-preview').then((mod) => mod.MarkdownPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner className="text-ink-faint" />
      </div>
    ),
  },
)

type Mode = 'write' | 'preview' | 'split'

interface EditorProps {
  post?: PostDetail
}

const EMPTY_TEMPLATE = '## 小节标题\n\n正文内容…\n'

/**
 * 编辑器。
 *
 * 视觉上放弃了"工具栏 + 文本框 + 预览框"的三段式卡片结构，
 * 改为**无边框的全幅版面**：标题是一个大号衬线输入框（无边框），
 * 正文与预览各占一栏，中间只用一条竖线分隔。
 * 这样写作时的视觉噪声最低。
 */
export function MarkdownEditor({ post }: EditorProps) {
  const router = useRouter()
  const toast = useToast()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [title, setTitle] = useState(post?.title ?? '')
  const [summary, setSummary] = useState(post?.summary ?? '')
  const [content, setContent] = useState(post?.content ?? '')
  const [tags, setTags] = useState<string[]>(post?.tags.map((tag) => tag.name) ?? [])
  const [tagDraft, setTagDraft] = useState('')
  const [mode, setMode] = useState<Mode>('split')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [dirty, setDirty] = useState(false)

  const isEditing = Boolean(post)
  const readingMinutes = useMemo(() => estimateReadingMinutes(content), [content])
  const markDirty = useCallback(() => setDirty(true), [])

  function commitTag() {
    const name = tagDraft.trim().replace(/\s+/g, ' ')
    if (!name) return
    if (tags.some((tag) => tag.toLowerCase() === name.toLowerCase())) {
      setTagDraft('')
      return
    }
    if (tags.length >= 8) {
      toast.error('最多 8 个标签')
      return
    }
    setTags((prev) => [...prev, name])
    setTagDraft('')
    markDirty()
  }

  function removeTag(name: string) {
    setTags((prev) => prev.filter((tag) => tag !== name))
    markDirty()
  }

  function onTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commitTag()
    } else if (event.key === 'Backspace' && !tagDraft && tags.length > 0) {
      removeTag(tags[tags.length - 1])
    }
  }

  function wrapSelection(before: string, after: string, placeholder: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const selected = value.slice(selectionStart, selectionEnd) || placeholder
    const next = value.slice(0, selectionStart) + before + selected + after + value.slice(selectionEnd)
    setContent(next)
    markDirty()
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(
        selectionStart + before.length,
        selectionStart + before.length + selected.length,
      )
    })
  }

  function prefixLines(prefix: string) {
    const textarea = textareaRef.current
    if (!textarea) return
    const { selectionStart, selectionEnd, value } = textarea
    const lineStart = value.lastIndexOf('\n', selectionStart - 1) + 1
    const lineEnd = value.indexOf('\n', selectionEnd)
    const end = lineEnd === -1 ? value.length : lineEnd
    const block = value.slice(lineStart, end) || '文本'
    const next = block
      .split('\n')
      .map((line) => `${prefix}${line}`)
      .join('\n')
    setContent(value.slice(0, lineStart) + next + value.slice(end))
    markDirty()
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart, lineStart + next.length)
    })
  }

  const save = useCallback(
    async (status: PostStatus) => {
      if (!title.trim()) {
        toast.error('请先填写标题')
        return
      }
      if (!content.trim()) {
        toast.error('正文不能为空')
        return
      }
      setSaving(true)
      try {
        if (isEditing && post) {
          await api.patch(`/api/posts/${post.slug}`, {
            title: title.trim(),
            summary: summary.trim(),
            content,
            tags,
            ...(status !== post.status ? { status } : {}),
          })
          toast.success(status === 'DRAFT' ? '已保存为草稿' : '已更新')
          setDirty(false)
          router.refresh()
        } else {
          const created = await api.post<PostDetail>('/api/posts', {
            title: title.trim(),
            summary: summary.trim(),
            content,
            tags,
            status,
          })
          toast.success(status === 'DRAFT' ? '草稿已保存' : '文章已发布')
          setDirty(false)
          router.push(status === 'DRAFT' ? '/admin/posts' : `/posts/${created.slug}`)
          router.refresh()
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '保存失败')
      } finally {
        setSaving(false)
      }
    },
    [content, isEditing, post, router, summary, tags, title, toast],
  )

  async function remove() {
    if (!post) return
    setDeleting(true)
    try {
      await api.del(`/api/posts/${post.slug}`)
      toast.success('文章已删除')
      setConfirmDelete(false)
      router.push('/admin/posts')
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '删除失败')
    } finally {
      setDeleting(false)
    }
  }

  // ⌘/Ctrl + S 存草稿，⌘/Ctrl + Enter 发布
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return
      if (event.key === 's') {
        event.preventDefault()
        void save('DRAFT')
      } else if (event.key === 'Enter') {
        event.preventDefault()
        void save('PUBLISHED')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [save])

  useEffect(() => {
    if (!dirty) return
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  const status: PostStatus = post?.status ?? 'DRAFT'

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col">
      {/* ===== 顶栏：左侧状态与快捷键，右侧动作 ===== */}
      <div className="shell flex items-center gap-4 border-b border-ink-line py-3 dark:border-night-line">
        <span className="eyebrow">{isEditing ? '编辑' : '新建'}</span>
        {dirty && <span className="eyebrow text-amber-700 dark:text-amber-500">未保存</span>}
        <span className="ml-auto hidden font-sans text-xs text-ink-faint md:block dark:text-ink-muted">
          ⌘S 存草稿 · ⌘↵ 发布
        </span>
        {isEditing && (
          <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} disabled={deleting}>
            删除
          </Button>
        )}
        <Button size="sm" onClick={() => save('DRAFT')} disabled={saving}>
          {saving && <Spinner />}
          存草稿
        </Button>
        <Button size="sm" variant="primary" onClick={() => save('PUBLISHED')} disabled={saving}>
          {status === 'PUBLISHED' ? '更新' : '发布'}
        </Button>
      </div>

      {/* ===== 标题与元信息：大号无边框输入，像写稿纸 ===== */}
      <div className="shell border-b border-ink-line py-8 dark:border-night-line">
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value)
            markDirty()
          }}
          placeholder="标题"
          maxLength={120}
          aria-label="文章标题"
          className="w-full border-0 bg-transparent p-0 font-serif text-3xl leading-tight text-ink-strong placeholder:text-ink-faint focus:outline-none focus:ring-0 dark:text-white dark:placeholder:text-ink-muted sm:text-4xl"
        />

        <textarea
          value={summary}
          onChange={(event) => {
            setSummary(event.target.value)
            markDirty()
          }}
          rows={2}
          maxLength={300}
          placeholder="摘要（留空则自动从正文截取）"
          aria-label="文章摘要"
          className="mt-4 w-full resize-none border-0 bg-transparent p-0 font-sans text-base leading-relaxed text-ink-soft placeholder:text-ink-faint focus:outline-none focus:ring-0 dark:text-ink-muted dark:placeholder:text-ink-muted"
        />

        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
          <div className="flex flex-1 flex-wrap items-center gap-x-2 gap-y-2">
            <span className="eyebrow">主题</span>
            {tags.map((tag) => (
              <span key={tag} className="flex items-center gap-1.5 font-sans text-xs text-ink-soft dark:text-ink-muted">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  aria-label={`移除标签 ${tag}`}
                  className="text-ink-faint transition-colors hover:text-red-700 dark:hover:text-red-400"
                >
                  ✕
                </button>
              </span>
            ))}
            <input
              value={tagDraft}
              onChange={(event) => setTagDraft(event.target.value)}
              onKeyDown={onTagKeyDown}
              onBlur={commitTag}
              disabled={tags.length >= 8}
              placeholder={tags.length >= 8 ? '已达上限' : '回车添加'}
              className="w-28 border-0 bg-transparent p-0 font-sans text-xs text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-white"
            />
          </div>

          <span className="meta">
            {content.length} 字 · 约 {readingMinutes} 分钟
          </span>
        </div>
      </div>

      {/* ===== 工具条 + 编辑区 ===== */}
      <div className="shell flex items-center gap-6 py-3">
        <div className="flex gap-6">
          {(
            [
              ['write', '编写'],
              ['split', '对照'],
              ['preview', '预览'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                'font-sans text-xs transition-colors',
                mode === value ? 'text-accent' : 'text-ink-muted hover:text-accent dark:text-ink-faint',
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {mode !== 'preview' && (
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1">
            {(
              [
                ['H', '二级标题', () => prefixLines('## ')],
                ['B', '加粗', () => wrapSelection('**', '**', '加粗文本')],
                ['I', '斜体', () => wrapSelection('*', '*', '斜体文本')],
                ['‹›', '行内代码', () => wrapSelection('`', '`', 'code')],
                ['{ }', '代码块', () => wrapSelection('\n```ts\n', '\n```\n', 'const x = 1')],
                ['链接', '插入链接', () => wrapSelection('[', '](https://)', '链接文字')],
                ['•', '无序列表', () => prefixLines('- ')],
                ['1.', '有序列表', () => prefixLines('1. ')],
                ['引用', '引用', () => prefixLines('> ')],
              ] as const
            ).map(([label, title, action]) => (
              <button
                key={title}
                type="button"
                title={title}
                aria-label={title}
                onClick={action}
                className="font-sans text-xs text-ink-muted transition-colors hover:text-accent dark:text-ink-faint"
              >
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setContent((prev) => (prev.trim() ? prev : EMPTY_TEMPLATE))
                markDirty()
              }}
              className="font-sans text-xs text-ink-faint transition-colors hover:text-accent dark:text-ink-muted"
            >
              模板
            </button>
          </div>
        )}
      </div>

      <div
        className={cn(
          'shell grid flex-1 border-t border-ink-line dark:border-night-line',
          mode === 'split' && 'lg:grid-cols-2 lg:divide-x lg:divide-ink-line lg:dark:divide-night-line',
        )}
      >
        {mode !== 'preview' && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(event) => {
              setContent(event.target.value)
              markDirty()
            }}
            spellCheck={false}
            placeholder="用 Markdown 写作：# 标题、**加粗**、`代码`、- 列表、> 引用…"
            aria-label="Markdown 正文"
            className="min-h-[30rem] w-full resize-none border-0 bg-transparent py-6 font-mono text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-none focus:ring-0 lg:pr-6 dark:text-ink-line dark:placeholder:text-ink-muted"
          />
        )}

        {mode !== 'write' && (
          <div className="min-h-[30rem] overflow-y-auto py-6 lg:pl-6">
            <MarkdownPreview source={content} />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title="删除这篇文章？"
        description="文章将被软删除，作者与管理员都无法再通过前台访问。"
        confirmText="删除"
        danger
        loading={deleting}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  )
}
