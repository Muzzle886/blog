'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { SearchIcon, CloseIcon } from './icons'
import { Spinner } from './ui'

/**
 * 搜索输入框。
 * URL（?q=）是唯一数据源：本组件只负责防抖写入 URL，由服务端组件重新查询，
 * 因此搜索结果页可以直接分享链接。
 */
export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // 浏览器前进/后退时同步输入框
  useEffect(() => {
    setValue(searchParams.get('q') ?? '')
  }, [searchParams])

  useEffect(() => {
    const trimmed = value.trim()
    const current = searchParams.get('q') ?? ''
    if (trimmed === current) {
      setPending(false)
      return
    }

    setPending(true)
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams()
      if (trimmed) params.set('q', trimmed)
      router.replace(params.toString() ? `/search?${params}` : '/search')
      setPending(false)
    }, 350)

    return () => window.clearTimeout(timer)
  }, [value, router, searchParams])

  // 快捷键：/ 聚焦搜索框
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const typing = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA'
      if (event.key === '/' && !typing) {
        event.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <div className="relative">
      <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="搜索标题、摘要与正文…（按 / 聚焦）"
        aria-label="搜索文章"
        className="h-11 w-full rounded-lg border border-ink-200 bg-white pl-10 pr-24 text-sm text-ink-900 placeholder:text-ink-400 transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
      />
      <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
        {pending && <Spinner className="h-3.5 w-3.5 text-ink-400" />}
        {value && (
          <button
            type="button"
            onClick={() => {
              setValue('')
              inputRef.current?.focus()
            }}
            aria-label="清空搜索"
            className="rounded p-1 text-ink-400 transition-colors hover:text-ink-700 dark:hover:text-ink-200"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
