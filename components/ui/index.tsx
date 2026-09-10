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
import { AlertIcon, InboxIcon } from '@/components/icons'

/* ============================== Button ============================== */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ink-900 text-white hover:bg-ink-800 dark:bg-ink-100 dark:text-ink-900 dark:hover:bg-white',
  secondary:
    'border border-ink-200 bg-white text-ink-700 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-ink-600 dark:hover:bg-ink-800',
  ghost:
    'text-ink-600 hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-ink-100',
  danger:
    'border border-red-200 bg-white text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:bg-transparent dark:text-red-400 dark:hover:bg-red-950/40',
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5',
  md: 'h-9 px-4 text-sm gap-2',
}

const BASE =
  'inline-flex select-none items-center justify-center rounded-md font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', className, children, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      className={cn(BASE, VARIANTS[variant], SIZES[size], className)}
      {...props}
    >
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
  variant = 'secondary',
  size = 'md',
  className,
  children,
  ...props
}: LinkButtonProps) {
  return (
    <Link href={href} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props}>
      {children}
    </Link>
  )
}

/* ============================== Field ============================== */

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
    <div>
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}
          {required && <span className="ml-0.5 text-red-500">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="mt-1.5 flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <AlertIcon className="h-3.5 w-3.5 shrink-0" />
          {error}
        </p>
      ) : hint ? (
        <p className="mt-1.5 hint">{hint}</p>
      ) : null}
    </div>
  )
}

const CONTROL =
  'w-full rounded-md border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 placeholder:text-ink-400 transition-colors duration-150 hover:border-ink-300 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-100 dark:placeholder:text-ink-500 dark:hover:border-ink-600 dark:disabled:bg-ink-800'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return <input ref={ref} className={cn(CONTROL, 'h-9', className)} {...props} />
  },
)

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(CONTROL, 'resize-y', className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, children, ...props }, ref) {
    return (
      <select ref={ref} className={cn(CONTROL, 'h-9 cursor-pointer pr-8', className)} {...props}>
        {children}
      </select>
    )
  },
)

/* ============================== Badge / Tag ============================== */

export function Badge({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded border border-ink-200 px-1.5 py-0.5 text-2xs font-medium text-ink-500 dark:border-ink-700 dark:text-ink-400',
        className,
      )}
    >
      {children}
    </span>
  )
}

/* ============================== Empty / Skeleton ============================== */

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
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-ink-200 px-6 py-16 text-center dark:border-ink-800">
      <InboxIcon className="h-7 w-7 text-ink-300 dark:text-ink-600" />
      <p className="mt-3 text-sm font-medium text-ink-700 dark:text-ink-300">{title}</p>
      {description && <p className="mt-1 max-w-sm text-xs hint">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      aria-hidden="true"
    />
  )
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card p-5">
          <div className="skeleton h-4 w-2/5" />
          <div className="skeleton mt-3 h-3 w-full" />
          <div className="skeleton mt-2 h-3 w-4/5" />
          <div className="skeleton mt-4 h-3 w-24" />
        </div>
      ))}
    </div>
  )
}
