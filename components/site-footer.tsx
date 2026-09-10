import Link from 'next/link'

const YEAR = new Date().getFullYear()

const LINKS = [
  { href: '/writing', label: '文章' },
  { href: '/topics', label: '主题' },
  { href: '/timeline', label: '时间线' },
  { href: '/about', label: '关于' },
]

/** 页脚：一条细线 + 单行文字，不做多栏站点地图 */
export function SiteFooter({ siteName }: { siteName: string }) {
  return (
    <footer className="mt-24 border-t border-ink-line dark:border-night-line">
      <div className="shell flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <p className="font-sans text-xs text-ink-faint dark:text-ink-muted">
          © {YEAR} {siteName}
        </p>
        <nav className="flex gap-6" aria-label="页脚导航">
          {LINKS.map((item) => (
            <Link key={item.href} href={item.href} className="tag">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}
