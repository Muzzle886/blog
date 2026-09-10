import Link from 'next/link'
import { cn } from '@/lib/cn'
import { ChevronLeftIcon, ChevronRightIcon } from './icons'

interface PaginationProps {
  page: number
  totalPages: number
  /** 生成第 N 页的链接（保留当前查询条件） */
  buildHref: (page: number) => string
  className?: string
}

/** 页码窗口：始终显示首尾页 + 当前页附近，其余折叠为省略号 */
function buildWindow(page: number, totalPages: number): (number | 'gap')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1)
  const pages = new Set<number>([1, totalPages, page, page - 1, page + 1])
  const sorted = Array.from(pages)
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((a, b) => a - b)

  const result: (number | 'gap')[] = []
  sorted.forEach((value, index) => {
    if (index > 0 && value - sorted[index - 1] > 1) result.push('gap')
    result.push(value)
  })
  return result
}

const ITEM = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-[13px]'

export function Pagination({ page, totalPages, buildHref, className }: PaginationProps) {
  if (totalPages <= 1) return null

  const window = buildWindow(page, totalPages)

  return (
    <nav
      className={cn('flex items-center justify-center gap-1', className)}
      aria-label="分页导航"
    >
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className={cn(ITEM, 'nav-link')} aria-label="上一页">
          <ChevronLeftIcon className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(ITEM, 'cursor-not-allowed text-ink-300 dark:text-ink-700')}>
          <ChevronLeftIcon className="h-4 w-4" />
        </span>
      )}

      {window.map((item, index) =>
        item === 'gap' ? (
          <span key={`gap-${index}`} className="px-1 text-ink-400">
            …
          </span>
        ) : item === page ? (
          <span
            key={item}
            aria-current="page"
            className={cn(ITEM, 'bg-ink-900 font-medium text-white dark:bg-ink-100 dark:text-ink-900')}
          >
            {item}
          </span>
        ) : (
          <Link key={item} href={buildHref(item)} className={cn(ITEM, 'nav-link')}>
            {item}
          </Link>
        ),
      )}

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className={cn(ITEM, 'nav-link')} aria-label="下一页">
          <ChevronRightIcon className="h-4 w-4" />
        </Link>
      ) : (
        <span className={cn(ITEM, 'cursor-not-allowed text-ink-300 dark:text-ink-700')}>
          <ChevronRightIcon className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
