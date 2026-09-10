'use client'

import { useEffect } from 'react'

/** 全局错误边界：只在客户端组件中生效，用于兜住渲染期异常 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[app] render error:', error)
  }, [error])

  return (
    <div className="shell flex min-h-[70vh] items-center py-20">
      <div className="grid w-full gap-8 lg:grid-cols-12">
        <div className="lg:col-span-3">
          <p className="font-mono text-xs text-ink-faint dark:text-ink-muted">500</p>
        </div>
        <div className="lg:col-span-8 lg:col-start-5">
          <h1 className="font-serif text-3xl text-ink-strong dark:text-white sm:text-4xl">
            页面出错了
          </h1>
          <p className="mt-6 max-w-md font-sans text-base leading-relaxed text-ink-soft dark:text-ink-muted">
            渲染时发生异常。可以重试，或返回首页继续浏览。
          </p>
          {error.digest && (
            <p className="mt-3 font-mono text-xs text-ink-faint dark:text-ink-muted">
              错误编号 {error.digest}
            </p>
          )}
          <div className="mt-8 flex gap-6">
            <button type="button" onClick={reset} className="link font-sans text-sm">
              重试
            </button>
            <a href="/" className="nav-item">
              回到首页
            </a>
          </div>
        </div>
      </div>
    </div>
  )
}
