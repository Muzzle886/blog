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
    <div className="container-narrow flex min-h-screen flex-col items-center justify-center py-20 text-center">
      <p className="font-mono text-5xl font-semibold text-ink-200 dark:text-ink-800">500</p>
      <h1 className="mt-5 text-lg font-semibold text-ink-900 dark:text-ink-50">
        页面出错了
      </h1>
      <p className="mt-2 max-w-sm text-sm text-ink-500 dark:text-ink-400">
        服务端渲染时发生异常。可以重试，或返回首页继续浏览。
      </p>
      {error.digest && (
        <p className="mt-2 font-mono text-xs text-ink-400 dark:text-ink-600">
          错误编号：{error.digest}
        </p>
      )}
      <div className="mt-6 flex gap-2">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center rounded-md bg-ink-900 px-4 text-sm font-medium text-white transition-colors hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900"
        >
          重试
        </button>
        <a
          href="/"
          className="inline-flex h-9 items-center rounded-md border border-ink-200 px-4 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800"
        >
          回到首页
        </a>
      </div>
    </div>
  )
}
