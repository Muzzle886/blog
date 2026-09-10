/**
 * 编辑器专用工具（客户端安全，不依赖 jsdom / server-only）。
 * 与 lib/markdown.ts 中的实现保持一致。
 */

/** 从 Markdown 正文提取纯文本摘要 */
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

/** 阅读时长估算（中文 400 字/分钟） */
export function estimateReadingMinutes(markdown: string): number {
  const chars = (markdown ?? '').replace(/\s/g, '').length
  return Math.max(1, Math.round(chars / 400))
}
