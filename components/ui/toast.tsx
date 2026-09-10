'use client'

import { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { AlertIcon, CheckIcon, CloseIcon } from '@/components/icons'
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

  return (
    <ToastContext.Provider value={value}>
      {children}
      {/* 固定右下角，不阻塞交互 */}
      <div
        className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        {toasts.map((item) => (
          <div
            key={item.id}
            className={cn(
              'pointer-events-auto flex animate-fade-in items-start gap-2 rounded-lg border px-3.5 py-2.5 text-sm shadow-sm',
              item.kind === 'error'
                ? 'border-red-200 bg-white text-red-700 dark:border-red-900/60 dark:bg-ink-900 dark:text-red-400'
                : 'border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100',
            )}
          >
            <span className="mt-0.5 shrink-0">
              {item.kind === 'error' ? (
                <AlertIcon className="h-4 w-4" />
              ) : (
                <CheckIcon className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              )}
            </span>
            <span className="flex-1 leading-snug">{item.message}</span>
            <button
              type="button"
              onClick={() => dismiss(item.id)}
              className="shrink-0 rounded p-0.5 text-ink-400 transition-colors hover:text-ink-700 dark:hover:text-ink-200"
              aria-label="关闭提示"
            >
              <CloseIcon className="h-3.5 w-3.5" />
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
