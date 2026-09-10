'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { Spinner } from './ui'

/**
 * 搜索输入框。
 * URL（?q=）是唯一数据源：本组件只负责防抖写入 URL，
 * 由服务端组件重新查询，因此搜索结果页可以直接分享链接。
 */
export function SearchInput({ initialQuery }: { initialQuery: string }) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [value, setValue] = useState(initialQuery)
  const [pending, setPending] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

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

  // 快捷键：/ 聚焦
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
      <input
        ref={inputRef}
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="输入关键词，按 / 聚焦"
        aria-label="搜索文章"
        className="field pr-8 text-lg"
      />
      {pending && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2">
          <Spinner className="text-ink-faint" />
        </span>
      )}
    </div>
  )
}
