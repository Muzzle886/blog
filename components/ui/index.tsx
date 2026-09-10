import Link from 'next/link'
import { forwardRef } from 'react'
import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'
import { cn } from '@/lib/cn'

/* ==========================================================================
 * 基础控件
 *
 * 风格约定（与旧版刻意相反）：
 *  - 没有"卡片"容器；控件不描边、不填色，靠排版与一条底线区分
 *  - 主按钮是页面上唯一"重"的元素（实心墨色），其余一律是文字
 *  - 圆角只有 2–3px，接近方正
 * ========================================================================== */

type Variant = 'primary' | 'outline' | 'ghost' | 'danger'
type Size = 'sm' | 'md' | 'lg'

const VARIANTS: Record<Variant, string> = {
  primary: 'btn-primary',
  outline: 'btn-outline',
  ghost: 'btn-ghost',
  danger: 'btn-ghost text-red-700 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-sm',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'outline', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button ref={ref} className={cn('btn', SIZES[size], VARIANTS[variant], className)} {...props}>
      {children}
    </button>
  )
})

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
  variant?: Variant
  size?: Size
  children: ReactNode
}

export function LinkButton({
  href,
  variant = 'outline',
  size = 'md',
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className={cn('btn', SIZES[size], VARIANTS[variant], className)} {...props}>
      {children}
    </Link>
  )
}

interface FieldProps {
  label?: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  children: ReactNode
}

export function Field({ label, htmlFor, error, hint, required, children }: FieldProps) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label htmlFor={htmlFor} className="eyebrow block">
          {label}
          {required && <span className="ml-1 text-accent">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="font-sans text-xs text-red-700 dark:text-red-400">{error}</p>
      ) : hint ? (
        <p className="font-sans text-xs text-ink-faint dark:text-ink-muted">{hint}</p>
      ) : null}
    </div>
  )
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn('field', className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn('field resize-y', className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn('field cursor-pointer', className)} {...props}>
        {children}
      </select>
    )
  },
)

/** 行内小标记：靠字距与字号区分，不加边框 */
export function Badge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'warn'
}) {
  const tones = {
    neutral: 'text-ink-faint dark:text-ink-muted',
    accent: 'text-accent',
    warn: 'text-amber-700 dark:text-amber-500',
  }
  return (
    <span className={cn('font-sans text-2xs font-medium uppercase', tones[tone])}>{children}</span>
  )
}

/** 空状态：一段排版，而不是一个虚线框 */
export function EmptyState({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="border-t border-ink-line py-20 dark:border-night-line">
      <p className="font-serif text-xl text-ink-strong dark:text-white">{title}</p>
      {description && (
        <p className="mt-2 max-w-md font-sans text-sm text-ink-muted dark:text-ink-faint">
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        // 圆形是 spinner 的语义需求；设计令牌里只有 2–3px 两档圆角，
        // 因此这里用任意值显式表达「全圆」，不额外新增圆角令牌
        'inline-block h-3.5 w-3.5 animate-spin rounded-[9999px] border border-current border-t-transparent',
        className,
      )}
      aria-hidden="true"
    />
  )
}

/** 列表骨架：保持与新排版一致的纵向节奏 */
export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="border-t border-ink-line py-7 dark:border-night-line">
          <div className="skeleton h-3 w-24" />
          <div className="skeleton mt-4 h-6 w-3/5" />
          <div className="skeleton mt-3 h-4 w-full" />
          <div className="skeleton mt-2 h-4 w-4/5" />
        </div>
      ))}
    </div>
  )
}

/** 栏目名：左侧一小段竖线 + 全大写小字 */
export function SectionLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-3', className)}>
      <span className="h-3 w-px bg-accent" aria-hidden="true" />
      <span className="eyebrow">{children}</span>
    </div>
  )
}
