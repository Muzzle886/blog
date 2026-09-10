'use client'

import { useEffect, useMemo, useState } from 'react'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import DOMPurify from 'dompurify'
import { PURIFY_CONFIG, installPurifyHooks } from '@/lib/sanitize-config'

/**
 * 编辑器右侧的实时预览。
 * 与 lib/markdown.ts 使用同一套 marked 配置与清洗白名单，
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
  // 防抖：避免每次按键都重跑高亮
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
      <div className="flex h-full items-center justify-center px-6 text-center">
        <p className="text-sm text-ink-400 dark:text-ink-500">
          预览区 · 开始输入 Markdown 即可看到效果
        </p>
      </div>
    )
  }

  return (
    <div
      className="markdown-body px-6 py-6"
      // 内容已通过 DOMPurify 白名单清洗
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
