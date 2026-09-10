'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import type { PublicUser } from '@/lib/types'
import { api } from '@/lib/api-client'
import { useToast } from './ui/toast'

/**
 * 账户菜单。
 * 与旧版差别：触发器是「昵称 + 一个细箭头」的纯文字，
 * 不用圆形头像底块；下拉面板用纸色 + 细边框，不用阴影。
 */
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
      <Link href="/login" className="nav-item ml-1">
        登录
      </Link>
    )
  }

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
        className="nav-item flex items-center gap-1.5 py-2"
      >
        <span className="max-w-[6rem] truncate">{user.nickname}</span>
        <span aria-hidden="true" className="text-2xs">
          ▾
        </span>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 w-48 animate-rise border border-ink-line bg-paper-raised py-2 dark:border-night-line dark:bg-night-raised"
        >
          <div className="px-4 pb-2">
            <p className="truncate font-serif text-sm text-ink-strong dark:text-white">{user.nickname}</p>
            <p className="meta mt-0.5 truncate">@{user.username}</p>
          </div>
          <div className="rule" />
          <div className="pt-2">
            <MenuLink href="/write" onClick={() => setOpen(false)}>
              写文章
            </MenuLink>
            <MenuLink href="/admin/posts" onClick={() => setOpen(false)}>
              我的文章
            </MenuLink>
            <MenuLink href="/settings" onClick={() => setOpen(false)}>
              账号设置
            </MenuLink>
            <div className="rule my-2" />
            <button
              type="button"
              role="menuitem"
              onClick={logout}
              disabled={pending}
              className="block w-full px-4 py-1.5 text-left font-sans text-sm text-ink-soft transition-colors hover:text-accent disabled:opacity-50 dark:text-ink-muted"
            >
              {pending ? '退出中…' : '退出登录'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function MenuLink({
  href,
  children,
  onClick,
}: {
  href: string
  children: React.ReactNode
  onClick: () => void
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onClick}
      className="block px-4 py-1.5 font-sans text-sm text-ink-soft transition-colors hover:text-accent dark:text-ink-muted"
    >
      {children}
    </Link>
  )
}
