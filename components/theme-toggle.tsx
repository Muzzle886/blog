'use client'

import { useCallback, useEffect, useState } from 'react'
import { MoonIcon, SunIcon } from './icons'

type Theme = 'light' | 'dark'

/**
 * 主题切换。初始值由 ThemeScript 直接写入 <html>，这里只负责读取与切换，
 * 避免服务端渲染与实际主题不一致导致的闪烁。
 */
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('light')
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  const toggle = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark'
      document.documentElement.classList.toggle('dark', next === 'dark')
      document.documentElement.style.colorScheme = next
      try {
        localStorage.setItem('blog-theme', next)
      } catch {
        /* 隐私模式下忽略 */
      }
      return next
    })
  }, [])

  const isDark = theme === 'dark'

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? '切换到浅色模式' : '切换到深色模式'}
      title={isDark ? '切换到浅色模式' : '切换到深色模式'}
      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
    >
      {mounted && isDark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  )
}
