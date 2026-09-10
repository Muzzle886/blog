import Link from 'next/link'
import { cn } from '@/lib/cn'

interface PaginationProps {
  page: number
  totalPages: number
  buildHref: (page: number) => string
  className?: string
}

/**
 * 分页：只保留「上一页 / 页码 / 下一页」三部分，去掉了页码按钮的方框。
 * 编辑风格里页码是文字而不是控件，用字重区分当前页。
 */
export function Pagination({ page, totalPages, buildHref, className }: PaginationProps) {
  if (totalPages <= 1) return null

  return (
    <nav
      className={cn(
        'mt-12 flex items-center justify-between border-t border-ink-line pt-6 dark:border-night-line',
        className,
      )}
      aria-label="分页导航"
    >
      {page > 1 ? (
        <Link href={buildHref(page - 1)} className="nav-item">
          ← 较新
        </Link>
      ) : (
        <span className="font-sans text-sm text-ink-faint/60 dark:text-ink-muted/50">← 较新</span>
      )}

      <span className="font-mono text-xs text-ink-faint dark:text-ink-muted">
        {String(page).padStart(2, '0')} / {String(totalPages).padStart(2, '0')}
      </span>

      {page < totalPages ? (
        <Link href={buildHref(page + 1)} className="nav-item">
          较早 →
        </Link>
      ) : (
        <span className="font-sans text-sm text-ink-faint/60 dark:text-ink-muted/50">较早 →</span>
      )}
    </nav>
  )
}
