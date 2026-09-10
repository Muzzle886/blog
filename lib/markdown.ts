import 'server-only'
import { Marked } from 'marked'
import { markedHighlight } from 'marked-highlight'
import hljs from 'highlight.js'
import createDOMPurify from 'dompurify'
import { JSDOM } from 'jsdom'
import { PURIFY_CONFIG, installPurifyHooks } from './sanitize-config'

/**
 * Markdown -> 安全 HTML（仅服务端）
 * 1. marked 渲染（代码块交给 highlight.js 做语法高亮）
 * 2. DOMPurify 白名单清洗，杜绝 XSS
 *
 * 清洗配置在 lib/sanitize-config.ts，与客户端预览共用同一份，
 * 避免两处配置漂移导致「预览安全、线上不安全」。
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

const window = new JSDOM('').window
const DOMPurify = createDOMPurify(window as unknown as Window & typeof globalThis)

installPurifyHooks(DOMPurify)

export function renderMarkdown(source: string): string {
  const raw = marked.parse(source ?? '', { async: false }) as string
  return DOMPurify.sanitize(raw, PURIFY_CONFIG)
}

/** 从 Markdown 正文提取纯文本摘要，用于列表页与 SEO description */
export function extractSummary(markdown: string, length = 160): string {
  const text = (markdown ?? '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`[^`]*`/g, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/[*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  return text.length > length ? `${text.slice(0, length)}…` : text
}

/** 生成阅读时长（按中文 400 字/分钟估算） */
export function estimateReadingMinutes(markdown: string): number {
  const chars = (markdown ?? '').replace(/\s/g, '').length
  return Math.max(1, Math.round(chars / 400))
}
