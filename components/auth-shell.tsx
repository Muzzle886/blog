import Link from 'next/link'

/**
 * 登录/注册页外壳。
 * 编辑式处理：不做居中卡片，而是左右分栏 —— 左边是刊名与一句话，
 * 右边是表单。这样表单本身不需要任何容器包裹。
 */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-ink-line dark:border-night-line">
        <div className="shell flex h-16 items-center">
          <Link
            href="/"
            className="font-serif text-lg tracking-tight text-ink-strong transition-colors hover:text-accent dark:text-white"
          >
            {process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"}
          </Link>
        </div>
      </header>

      <main className="shell py-16 lg:py-24">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <h1 className="font-serif text-3xl text-ink-strong dark:text-white">{title}</h1>
            <p className="mt-4 max-w-xs font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
              {subtitle}
            </p>
            <Link href="/" className="mt-8 inline-block nav-item">
              ← 回到首页
            </Link>
          </div>

          <div className="min-w-0 lg:col-span-5 lg:col-start-7">
            {children}
          </div>
        </div>
      </main>
    </div>
  )
}
