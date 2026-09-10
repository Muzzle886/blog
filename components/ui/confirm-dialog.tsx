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

/**
 * 轻量确认弹窗。
 * 视觉上刻意"薄"：纸色面板 + 一条细边框，不用阴影和大圆角，
 * 与全站的无卡片语言保持一致。
 */
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
        className="absolute inset-0 bg-ink-strong/25 dark:bg-night/70"
        onClick={onCancel}
        aria-hidden="true"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative w-full max-w-sm animate-rise border border-ink-line bg-paper-raised p-6 dark:border-night-line dark:bg-night-raised"
      >
        <h2 className="font-serif text-lg text-ink-strong dark:text-white">{title}</h2>
        {description && (
          <p className="mt-2 font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
            {description}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-3">
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
