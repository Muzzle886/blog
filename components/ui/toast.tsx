'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { cn } from '@/lib/cn'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  kind: ToastKind
  message: string
}

interface ToastContextValue {
  toast: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const DURATION = 3200

/**
 * 提示条。不放图标、不加阴影：左侧一条彩色短线表示语义，
 * 其余交给排版 —— 与全站"无卡片"的语言一致。
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random()
      setToasts((prev) => [...prev.slice(-2), { id, kind, message }])
      window.setTimeout(() => dismiss(id), DURATION)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (message: string) => toast(message, 'success'),
      error: (message: string) => toast(message, 'error'),
    }),
    [toast],
  )

  const bar = {
    success: 'bg-emerald-600 dark:bg-emerald-500',
    error: 'bg-red-600 dark:bg-red-500',
    info: 'bg-accent',
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-6 right-6 z-50 flex w-[min(22rem,calc(100vw-3rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className="pointer-events-auto flex animate-rise items-stretch border border-ink-line bg-paper-raised dark:border-night-line dark:bg-night-raised"
          >
            <span className={cn('w-0.5 shrink-0', bar[item.kind])} aria-hidden="true" />
            <p className="flex-1 px-4 py-3 font-sans text-sm text-ink dark:text-ink-line">
              {item.message}
            </p>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="px-3 font-sans text-xs text-ink-faint transition-colors hover:text-accent"
              aria-label="关闭提示"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast 必须在 <ToastProvider> 内使用')
  }
  return context
}
