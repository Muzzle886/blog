'use client'

import { useEffect, useMemo, useState } from 'react'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { PURIFY_CONFIG, installPurifyHooks } from '@/lib/sanitize-config'

/**
 * 编辑器右侧的实时预览。
 * 清洗配置来自 lib/sanitize-config.ts（与线上渲染同一份），
 * 保证「预览所见」与「保存后渲染」一致。仅在客户端运行。
 */
const marked = new Marked(
  markedHighlight({
    emptyLangClass: 'hljs',
    langPrefix: 'hljs language-',
    highlight(code, lang) {
      const language = hljs.getLanguage(lang) ? lang : 'plaintext'
      return hljs.highlight(code, { language }).value
    },
  }),
)
marked.setOptions({ gfm: true, breaks: true })

installPurifyHooks(DOMPurify)

export function MarkdownPreview({ source }: { source: string }) {
  const [debounced, setDebounced] = useState(source)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(source), 150)
    return () => window.clearTimeout(timer)
  }, [source])

  const html = useMemo(() => {
    if (!debounced.trim()) return ''
    const raw = marked.parse(debounced, { async: false }) as string
    return DOMPurify.sanitize(raw, PURIFY_CONFIG)
  }, [debounced])

  if (!html) {
    return (
      <p className="font-sans text-sm text-ink-faint dark:text-ink-muted">
        预览区 · 开始输入即可看到排版效果
      </p>
    )
  }

  return (
    <div
      className="markdown-body reading"
      // 内容已通过 DOMPurify 白名单清洗
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
