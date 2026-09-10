'use client'

import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PostDetail, PostStatus } from '@/lib/types'
import { api } from '@/lib/api-client'
import { cn } from '@/lib/cn'
import { estimateReadingMinutes, extractSummary } from '@/lib/editor-utils'
import { CloseIcon, EyeIcon, PenIcon, TrashIcon } from './icons'
import { Button, Field, Input, Spinner, Textarea } from './ui'
import { ConfirmDialog } from './ui/confirm-dialog'
import { useToast } from './ui/toast'

// 预览依赖 highlight.js / DOMPurify，只在客户端加载，避免进入 SSR 与首屏包
const MarkdownPreview = dynamic(
  () => import('./markdown-preview').then((mod) => mod.MarkdownPreview),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Spinner className="h-4 w-4 text-ink-400" />
      </div>
    ),
  },
)

type Mode = 'write' | 'preview' | 'split'

interface EditorProps {
  /** 传入则为编辑模式 */
  post?: PostDetail
}

const EMPTY_TEMPLATE = '## 小节标题\n\n正文内容…\n'

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
  const charCount = content.length

  const markDirty = useCallback(() => setDirty(true), [])

  /* ============ 标签输入 ============ */
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

  /* ============ 工具栏 ============ */
  /** 在选区两侧包裹标记（加粗、斜体等） */
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

  /** 在选区每行前加前缀（标题、列表、引用） */
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
    const updated = value.slice(0, lineStart) + next + value.slice(end)
    setContent(updated)
    markDirty()
    requestAnimationFrame(() => {
      textarea.focus()
      textarea.setSelectionRange(lineStart, lineStart + next.length)
    })
  }

  /* ============ 保存 ============ */
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

  /* 快捷键：⌘/Ctrl + S 存草稿，⌘/Ctrl + Enter 发布 */
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

  /* 未保存离开提醒 */
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
  const previewSummary = summary.trim() || extractSummary(content, 120)

  return (
    <div className="flex min-h-screen flex-col">
      {/* ============ 顶栏 ============ */}
      <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/90 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/90">
        <div className="container-page flex h-14 items-center gap-3">
          <div className="flex items-center gap-2 text-sm text-ink-500 dark:text-ink-400">
            <PenIcon className="h-4 w-4" />
            <span className="hidden sm:inline">
              {isEditing ? '编辑文章' : '新建文章'}
            </span>
            {dirty && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs text-amber-700 dark:bg-amber-950/60 dark:text-amber-500">
                未保存
              </span>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden text-xs hint md:block">
              ⌘S 存草稿 · ⌘↵ 发布
            </span>
            {isEditing && (
              <Button
                size="sm"
                variant="danger"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                aria-label="删除文章"
              >
                <TrashIcon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">删除</span>
              </Button>
            )}
            <Button
              size="sm"
              onClick={() => save('DRAFT')}
              disabled={saving}
            >
              {saving && <Spinner className="h-3.5 w-3.5" />}
              存草稿
            </Button>
            <Button
              size="sm"
              variant="primary"
              onClick={() => save('PUBLISHED')}
              disabled={saving}
            >
              {status === 'PUBLISHED' ? '更新发布' : '发布'}
            </Button>
          </div>
        </div>
      </header>

      <div className="container-page flex-1 py-6">
        {/* ============ 元信息 ============ */}
        <div className="mb-5 grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="space-y-4">
            <input
              value={title}
              onChange={(event) => {
                setTitle(event.target.value)
                markDirty()
              }}
              placeholder="文章标题"
              maxLength={120}
              aria-label="文章标题"
              className="w-full border-0 bg-transparent p-0 text-2xl font-semibold tracking-tight text-ink-900 placeholder:text-ink-300 focus:outline-none focus:ring-0 dark:text-ink-50 dark:placeholder:text-ink-600"
            />
            <Textarea
              value={summary}
              onChange={(event) => {
                setSummary(event.target.value)
                markDirty()
              }}
              rows={2}
              maxLength={300}
              placeholder="摘要（留空则自动从正文截取）"
              aria-label="文章摘要"
            />
          </div>

          <div className="space-y-4">
            <Field label="标签" hint="回车或逗号添加，最多 8 个">
              <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-ink-200 bg-white px-2 py-1.5 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/20 dark:border-ink-700 dark:bg-ink-900">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 rounded border border-ink-200 bg-ink-50 px-1.5 py-0.5 text-2xs text-ink-600 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-300"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      aria-label={`移除标签 ${tag}`}
                      className="text-ink-400 transition-colors hover:text-red-600 dark:hover:text-red-400"
                    >
                      <CloseIcon className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  value={tagDraft}
                  onChange={(event) => setTagDraft(event.target.value)}
                  onKeyDown={onTagKeyDown}
                  onBlur={commitTag}
                  disabled={tags.length >= 8}
                  placeholder={tags.length >= 8 ? '已达上限' : '添加标签…'}
                  className="min-w-20 flex-1 border-0 bg-transparent p-0 text-xs text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-ink-100"
                />
              </div>
            </Field>

            <div className="rounded-md border border-ink-200 px-3 py-2.5 dark:border-ink-700">
              <p className="text-xs text-ink-400 dark:text-ink-500">
                {charCount} 字 · 约 {readingMinutes} 分钟阅读
              </p>
              <p className="mt-1 line-clamp-2 text-2xs text-ink-400 dark:text-ink-500">
                摘要预览：{previewSummary || '（暂无）'}
              </p>
            </div>
          </div>
        </div>

        {/* ============ 编辑器 ============ */}
        <div className="overflow-hidden rounded-lg border border-ink-200 dark:border-ink-800">
          <div className="flex items-center gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex gap-1">
              {(
                [
                  ['write', '编辑'],
                  ['split', '分栏'],
                  ['preview', '预览'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={cn(
                    'rounded px-2 py-1 text-xs transition-colors',
                    mode === value
                      ? 'bg-white font-medium text-ink-900 shadow-sm dark:bg-ink-800 dark:text-ink-100'
                      : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-200',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <Toolbar
              onBold={() => wrapSelection('**', '**', '加粗文本')}
              onItalic={() => wrapSelection('*', '*', '斜体文本')}
              onCode={() => wrapSelection('`', '`', 'code')}
              onCodeBlock={() => wrapSelection('\n```ts\n', '\n```\n', 'const x = 1')}
              onLink={() => wrapSelection('[', '](https://)', '链接文字')}
              onH1={() => prefixLines('## ')}
              onList={() => prefixLines('- ')}
              onOrderedList={() => prefixLines('1. ')}
              onQuote={() => prefixLines('> ')}
              onInsertTemplate={() => {
                setContent((prev) => (prev.trim() ? prev : EMPTY_TEMPLATE))
                markDirty()
              }}
              compact={mode === 'preview'}
            />
          </div>

          <div
            className={cn(
              'grid min-h-[26rem]',
              mode === 'split' && 'lg:grid-cols-2 lg:divide-x lg:divide-ink-200 lg:dark:divide-ink-800',
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
                placeholder="支持 Markdown 语法：# 标题、**加粗**、`代码`、- 列表、> 引用…"
                aria-label="Markdown 正文"
                className="min-h-[26rem] w-full resize-none border-0 bg-transparent px-6 py-6 font-mono text-[13.5px] leading-relaxed text-ink-800 placeholder:text-ink-300 focus:outline-none focus:ring-0 dark:text-ink-200 dark:placeholder:text-ink-600"
              />
            )}

            {mode !== 'write' && (
              <div className="max-h-[46rem] overflow-y-auto bg-white dark:bg-ink-950">
                <MarkdownPreview source={content} />
              </div>
            )}
          </div>
        </div>

        <p className="mt-3 flex items-center gap-1.5 text-xs hint">
          <EyeIcon className="h-3.5 w-3.5" />
          预览使用与线上完全相同的渲染管线（marked + DOMPurify 白名单清洗）
        </p>
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

/** 格式化工具栏：只做纯文本变换，不引入富文本编辑器 */
function Toolbar({
  onBold,
  onItalic,
  onCode,
  onCodeBlock,
  onLink,
  onH1,
  onList,
  onOrderedList,
  onQuote,
  onInsertTemplate,
  compact,
}: {
  onBold: () => void
  onItalic: () => void
  onCode: () => void
  onCodeBlock: () => void
  onLink: () => void
  onH1: () => void
  onList: () => void
  onOrderedList: () => void
  onQuote: () => void
  onInsertTemplate: () => void
  compact: boolean
}) {
  const items = [
    { label: 'H', title: '二级标题', onClick: onH1, className: 'font-semibold' },
    { label: 'B', title: '加粗', onClick: onBold, className: 'font-bold' },
    { label: 'I', title: '斜体', onClick: onItalic, className: 'italic' },
    { label: '<>', title: '行内代码', onClick: onCode, className: 'font-mono' },
    { label: '{ }', title: '代码块', onClick: onCodeBlock, className: 'font-mono' },
    { label: '链', title: '插入链接', onClick: onLink },
    { label: '•', title: '无序列表', onClick: onList },
    { label: '1.', title: '有序列表', onClick: onOrderedList },
    { label: '❝', title: '引用', onClick: onQuote },
  ]

  return (
    <div className={cn('ml-auto items-center gap-0.5', compact ? 'hidden' : 'flex')}>
      {items.map((item) => (
        <button
          key={item.title}
          type="button"
          title={item.title}
          aria-label={item.title}
          onClick={item.onClick}
          className={cn(
            'h-6 min-w-6 rounded px-1.5 text-xs text-ink-500 transition-colors hover:bg-white hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
            item.className,
          )}
        >
          {item.label}
        </button>
      ))}
      <button
        type="button"
        title="插入模板"
        onClick={onInsertTemplate}
        className="ml-1 h-6 rounded px-2 text-xs text-ink-500 transition-colors hover:bg-white hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        模板
      </button>
    </div>
  )
}
