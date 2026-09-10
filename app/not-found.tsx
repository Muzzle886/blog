import Link from 'next/link'

export const metadata = {
  title: '页面不存在',
}

export default function NotFound() {
  return (
    <div className="container-narrow flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-5xl font-semibold text-ink-200 dark:text-ink-800">404</p>
      <h1 className="mt-5 text-lg font-semibold text-ink-900 dark:text-ink-50">
        这个页面不存在
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500 dark:text-ink-400">
        链接可能已经失效，或者文章已被作者删除。
      </p>
      <div className="mt-6 flex gap-2">
        <Link
          href="/"
          className="inline-flex h-9 items-center rounded-md bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900"
        >
          回到首页
        </Link>
        <Link
          href="/search"
          className="inline-flex h-9 items-center rounded-md border border-ink-200 px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        >
          搜索文章
        </Link>
      </div>
    </div>
  )
}
