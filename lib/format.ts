/** 日期格式化（固定 locale，避免服务端/客户端渲染结果不一致） */

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
})

const DATE_FORMAT = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
})

export function formatDateTime(input: string | Date | null | undefined): string {
  if (!input) return ''
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return ''
  return DATE_TIME_FORMAT.format(date)
}

export function formatDate(input: string | Date | null | undefined): string {
  if (!input) return ''
  const date = typeof input === 'string' ? new Date(input) : input
  if (Number.isNaN(date.getTime())) return ''
  return DATE_FORMAT.format(date)
}

/** 相对时间：仅在客户端组件中使用（依赖当前时间） */
export function formatRelative(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - date.getTime()
  const minute = 60_000
  const hour = 60 * minute
  const day = 24 * hour

  if (diff < minute) return '刚刚'
  if (diff < hour) return `${Math.floor(diff / minute)} 分钟前`
  if (diff < day) return `${Math.floor(diff / hour)} 小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)} 天前`
  return formatDate(date)
}

export function toIso(input: Date | string | null | undefined): string {
  if (!input) return ''
  const date = typeof input === 'string' ? new Date(input) : input
  return Number.isNaN(date.getTime()) ? '' : date.toISOString()
}
