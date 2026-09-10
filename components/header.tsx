'use client'

import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'
import { MenuIcon, PenIcon, SearchIcon, CloseIcon } from './icons'
import { ThemeToggle } from './theme-toggle'
import { UserMenu } from './user-menu'
import type { PublicUser } from '@/lib/types'

const NAV_ITEMS = [
  { href: '/', label: '首页' },
  { href: '/tags', label: '标签' },
  { href: '/archive', label: '归档' },
  { href: '/about', label: '关于' },
]

export function Header({ user, siteName }: { user: PublicUser | null; siteName: string }) {
  const pathname = usePathname()
  const [menuOpen, setMenuOpen] = useState(false)

  // 路由变化时收起移动端菜单
  useEffect(() => setMenuOpen(false), [pathname])

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href)

  return (
    <header className="sticky top-0 z-30 border-b border-ink-200 bg-white/85 backdrop-blur-md dark:border-ink-800 dark:bg-ink-950/85">
      <div className="container-page flex h-14 items-center gap-3">
        <Link
          href="/"
          className="mr-2 shrink-0 text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-50"
        >
          {siteName}
        </Link>

        <nav className="hidden items-center gap-0.5 sm:flex">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn('nav-link', isActive(item.href) && 'nav-link-active')}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1">
          <HeaderSearch />
          <ThemeToggle />
          <Link
            href="/write"
            className="hidden h-8 items-center gap-1.5 rounded-md px-2.5 text-[13px] text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900 sm:inline-flex dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
          >
            <PenIcon className="h-4 w-4" />
            写作
          </Link>
          <UserMenu user={user} />
          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 sm:hidden dark:hover:bg-ink-800"
            onClick={() => setMenuOpen((value) => !value)}
            aria-label="打开导航菜单"
            aria-expanded={menuOpen}
          >
            {menuOpen ? <CloseIcon className="h-4 w-4" /> : <MenuIcon className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-ink-200 sm:hidden dark:border-ink-800">
          <div className="container-page flex flex-col py-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'rounded-md px-2 py-2 text-sm text-ink-600 dark:text-ink-400',
                  isActive(item.href) && 'bg-ink-100 font-medium text-ink-900 dark:bg-ink-800 dark:text-ink-100',
                )}
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/write"
              className="rounded-md px-2 py-2 text-sm text-ink-600 dark:text-ink-400"
            >
              写作
            </Link>
          </div>
        </nav>
      )}
    </header>
  )
}

/** 顶栏搜索：回车跳转 /search?q=，保持 URL 可分享 */
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
        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-500 transition-colors hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
      >
        <SearchIcon className="h-4 w-4" />
      </button>
    )
  }

  return (
    <form onSubmit={submit} className="relative">
      <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
      <input
        autoFocus
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={() => !value && setOpen(false)}
        onKeyDown={(event) => event.key === 'Escape' && setOpen(false)}
        placeholder="搜索文章…"
        aria-label="搜索文章"
        className="h-8 w-40 rounded-md border border-ink-200 bg-white pl-8 pr-2 text-[13px] text-ink-900 placeholder:text-ink-400 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 sm:w-56 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100"
      />
    </form>
  )
}
