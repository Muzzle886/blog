'use client'

import { useEffect, useRef } from 'react'
import { Button } from './index'

interface ConfirmDialogProps {
  open: boolean
  title: string
  description?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/** 轻量确认弹窗，替代 antd Modal */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmText = '确认',
  cancelText = '取消',
  danger = false,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', onKeyDown)
    confirmRef.current?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-ink-950/40 backdrop-blur-[1px]"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm animate-fade-in rounded-lg border border-ink-200 bg-white p-5 dark:border-ink-700 dark:bg-ink-900"
      >
        <h2 className="text-sm font-semibold text-ink-900 dark:text-ink-100">{title}</h2>
        {description && (
          <p className="mt-2 text-sm text-ink-500 dark:text-ink-400">{description}</p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <Button size="sm" variant="ghost" onClick={onCancel} disabled={loading}>
            {cancelText}
          </Button>
          <Button
            ref={confirmRef}
            size="sm"
            variant={danger ? 'danger' : 'primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? '处理中…' : confirmText}
          </Button>
        </div>
      </div>
    </div>
  )
}
