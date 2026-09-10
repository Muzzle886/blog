import Link from 'next/link'

const YEAR = new Date().getFullYear()

export function SiteFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="mt-20 border-t border-ink-200 dark:border-ink-800">
      <div className="container-page flex flex-col gap-3 py-8 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between dark:text-ink-500">
        <p>
          © {YEAR} {siteName} · 由 Next.js 与 Prisma 驱动
        </p>
        <div className="flex items-center gap-4">
          <Link href="/about" className="transition-colors hover:text-ink-700 dark:hover:text-ink-300">
            关于
          </Link>
          <Link href="/archive" className="transition-colors hover:text-ink-700 dark:hover:text-ink-300">
            归档
          </Link>
          <Link href="/api/stats" className="transition-colors hover:text-ink-700 dark:hover:text-ink-300">
            API
          </Link>
        </div>
      </div>
    </footer>
  )
}
