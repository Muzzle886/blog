import Link from 'next/link'

/** 登录/注册页的极简外壳：只有站点名与居中卡片 */
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
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-ink-200 dark:border-ink-800">
        <div className="container-page flex h-14 items-center">
          <Link
            href="/"
            className="text-[15px] font-semibold tracking-tight text-ink-900 dark:text-ink-50"
          >
            {process.env.NEXT_PUBLIC_SITE_NAME || "Muzzle's Blog"}
          </Link>
        </div>
      </header>

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-7 text-center">
            <h1 className="text-xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
              {title}
            </h1>
            <p className="mt-1.5 text-sm text-ink-500 dark:text-ink-400">{subtitle}</p>
          </div>
          <div className="card p-6">{children}</div>
        </div>
      </main>
    </div>
  )
}
