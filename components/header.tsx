'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'
import type { PublicUser } from '@/lib/types'

const NAV = [
  { href: '/writing', label: '文章' },
  { href: '/topics', label: '主题' },
  { href: '/timeline', label: '时间线' },
  { href: '/about', label: '关于' },
]

/**
 * 报头（masthead）。
 *
 * 与旧版的区别：不再是"首页/标签/归档"的功能导航条，
 * 而是一个编辑式的报头 —— 刊名居左用衬线体，栏目居右，
 * 没有背景块、没有激活态底色，当前栏目只靠字重区分。
 */
export function Header({ user, siteName }: { user: PublicUser | null; siteName: string }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => setMenuOpen(false), [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <header className="sticky top-0 z-30 border-b border-ink-line bg-paper/90 backdrop-blur-md dark:border-night-line dark:bg-night/90">
      <div className="shell flex h-16 items-center gap-6">
        <Link
          href="/"
          className="shrink-0 font-serif text-lg tracking-tight text-ink-strong transition-colors hover:text-accent dark:text-white"
        >
          {siteName}
        </Link>

        <nav className="ml-auto hidden items-center gap-7 sm:flex" aria-label="主导航">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? 'page' : undefined}
              className={cn('nav-item', isActive(item.href) && 'nav-item-active')}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1 sm:ml-0">
          <HeaderSearch />
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-ink-line sm:hidden dark:border-night-line" aria-label="主导航">
          <div className="shell flex flex-col py-3">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn('py-2 font-sans text-sm text-ink-soft dark:text-ink-muted', isActive(item.href) && 'nav-item-active')}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  )
}

/**
 * 检索入口。
 * 默认只是一个图标位；点开后在原位展开一条底线输入框 ——
 * 不弹层、不占位，符合报头的克制感。
 */
function HeaderSearch() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const [value, setValue] = useState(pathname === '/search' ? searchParams.get('q') ?? '' : '')
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (pathname === '/search') setValue(searchParams.get('q') ?? '')
  }, [pathname, searchParams])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const q = value.trim()
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : '/search')
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="搜索文章"
        className="flex h-8 w-8 items-center justify-center text-ink-muted transition-colors hover:text-accent dark:text-ink-faint"
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="h-4 w-4" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="m20 20-3.5-3.5" strokeLinecap="round" />
        </svg>
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="relative">
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="搜索"
        aria-label="搜索文章"
        className="field w-32 py-1 text-sm sm:w-44"
      />
    </form>
  )
}
