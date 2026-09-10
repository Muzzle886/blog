'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { PublicUser } from '@/lib/types'
import { api } from '@/lib/api-client'
import { PenIcon, LogoutIcon, UserIcon, ArchiveIcon } from './icons'
import { useToast } from './ui/toast'

/** 头部用户菜单：登录态展示头像 + 下拉，未登录展示登录入口 */
export function UserMenu({ user }: { user: PublicUser | null }) {
  const router = useRouter()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  if (!user) {
    return (
      <div className="flex items-center gap-1">
        <Link href="/login" className="nav-link">
          登录
        </Link>
        <Link
          href="/register"
          className="inline-flex h-8 items-center rounded-md bg-ink-900 px-3 text-[13px] font-medium text-white transition-colors hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white"
        >
          注册
        </Link>
      </div>
    )
  }

  const initial = (user.nickname || user.username).slice(0, 1).toUpperCase()

  async function logout() {
    setPending(true)
    try {
      await api.del('/api/auth/session')
      toast.success('已退出登录')
      setOpen(false)
      router.push('/')
      router.refresh()
    } catch {
      toast.error('退出失败，请重试')
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-8 items-center gap-2 rounded-md px-1.5 transition-colors hover:bg-ink-100 dark:hover:bg-ink-800"
      >
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-2xs font-semibold text-white dark:bg-ink-100 dark:text-ink-900">
          {initial}
        </span>
        <span className="hidden max-w-[6rem] truncate text-[13px] text-ink-700 sm:block dark:text-ink-300">
          {user.nickname}
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-10 z-40 w-52 animate-fade-in overflow-hidden rounded-lg border border-ink-200 bg-white py-1 dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="px-3 py-2">
            <p className="truncate text-sm font-medium text-ink-900 dark:text-ink-100">
              {user.nickname}
            </p>
            <p className="truncate text-xs hint">@{user.username}</p>
          </div>
          <div className="divider" />
          <MenuLink href="/write" icon={<PenIcon className="h-4 w-4" />} onClick={() => setOpen(false)}>
            写文章
          </MenuLink>
          <MenuLink
            href="/admin/posts"
            icon={<ArchiveIcon className="h-4 w-4" />}
            onClick={() => setOpen(false)}
          >
            我的文章
          </MenuLink>
          <MenuLink
            href="/settings"
            icon={<UserIcon className="h-4 w-4" />}
            onClick={() => setOpen(false)}
          >
            账号设置
          </MenuLink>
          <div className="divider" />
          <button
            type="button"
            role="menuitem"
            onClick={logout}
            disabled={pending}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-ink-600 transition-colors hover:bg-ink-50 disabled:opacity-50 dark:text-ink-400 dark:hover:bg-ink-800"
          >
            <LogoutIcon className="h-4 w-4" />
            {pending ? '退出中…' : '退出登录'}
          </button>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  href,
  icon,
  children,
  onClick,
}: {
  href: string
  icon: React.ReactNode
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="flex items-center gap-2 px-3 py-2 text-sm text-ink-600 transition-colors hover:bg-ink-50 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100"
    >
      {icon}
      {children}
    </Link>
  )
}
