import Link from 'next/link'

export const metadata = {
  title: '页面不存在',
}

export default function NotFound() {
  return (
    <div className="shell flex min-h-[70vh] items-center py-20">
      <div className="grid w-full gap-8 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <p className="font-mono text-xs text-ink-faint dark:text-ink-muted">404</p>
        </div>
        <div className="lg:col-span-8 lg:col-start-5">
          <h1 className="font-serif text-3xl text-ink-strong dark:text-white sm:text-4xl">
            这里什么都没有
          </h1>
          <p className="mt-6 max-w-md font-sans text-base leading-relaxed text-ink-soft dark:text-ink-muted">
            链接可能已经失效，或者这篇内容已被作者移除。
          </p>
          <div className="mt-8 flex gap-6">
            <Link href="/" className="link font-sans text-sm">
              回到首页
            </Link>
            <Link href="/search" className="nav-item">
              搜索文章
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
