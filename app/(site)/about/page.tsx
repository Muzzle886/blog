import type { Metadata } from 'next'
import Link from 'next/link'
import { postService } from '@/server/post-service'
import { userService } from '@/server/user-service'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '关于',
  description: '关于本站与技术栈',
}

const STACK = [
  { name: 'Next.js 14 (App Router)', detail: '服务端组件渲染页面，路由处理器提供 REST API' },
  { name: 'Prisma + MySQL', detail: '类型安全的数据访问，迁移文件随代码入库' },
  { name: 'Tailwind CSS', detail: '手写的极简扁平设计系统，未引入组件库' },
  { name: 'marked + DOMPurify', detail: 'Markdown 服务端渲染，输出经白名单清洗' },
  { name: 'scrypt 会话', detail: 'Node 内置密码哈希 + 数据库会话表' },
]

export default async function AboutPage() {
  const [stats, admin] = await Promise.all([
    postService.stats(),
    userService.getProfileByUsername('muzzle').catch(() => null),
  ])

  return (
    <div className="container-narrow py-10">
      <header className="mb-10">
        <h1 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-ink-50">
          关于本站
        </h1>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-500 dark:text-ink-400">
          一个用于记录工程实践与架构思考的独立博客。界面刻意保持极简：
          没有装饰性动效，没有第三方组件库，所有层级靠留白、字重和 1px 边框建立。
        </p>
      </header>

      <section className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="已发布" value={stats.posts} />
        <StatCard label="标签" value={stats.tags} />
        <StatCard label="评论" value={stats.comments} />
        <StatCard label="草稿" value={stats.drafts} />
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
          技术栈
        </h2>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {STACK.map((item) => (
            <li key={item.name} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-baseline sm:gap-4">
              <span className="w-52 shrink-0 text-sm font-medium text-ink-800 dark:text-ink-200">
                {item.name}
              </span>
              <span className="text-xs text-ink-500 dark:text-ink-400">{item.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      {admin && (
        <section className="mb-10">
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wide text-ink-400 dark:text-ink-500">
            作者
          </h2>
          <div className="card flex items-start gap-4 p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink-900 text-sm font-semibold text-white dark:bg-ink-100 dark:text-ink-900">
              {admin.user.nickname.slice(0, 1).toUpperCase()}
            </span>
            <div>
              <Link
                href={`/users/${admin.user.username}`}
                className="text-sm font-medium text-ink-900 hover:text-accent dark:text-ink-100"
              >
                {admin.user.nickname}
              </Link>
              <p className="mt-1 text-xs text-ink-500 dark:text-ink-400">
                {admin.user.bio ?? '这个人很懒，什么都没写。'}
              </p>
              <p className="mt-2 text-xs hint">
                {admin.postCount} 篇文章 · @{admin.user.username}
              </p>
            </div>
          </div>
        </section>
      )}

    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="card px-4 py-3">
      <p className="text-xl font-semibold tabular-nums text-ink-900 dark:text-ink-50">
        {value}
      </p>
      <p className="mt-0.5 text-xs text-ink-400 dark:text-ink-500">{label}</p>
    </div>
  )
}
