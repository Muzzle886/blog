import type { Metadata } from 'next'
import Link from 'next/link'
import { postService } from '@/server/post-service'
import { userService } from '@/server/user-service'
import { SectionLabel } from '@/components/ui'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: '关于',
  description: '关于本站与技术栈',
}

const STACK = [
  { name: 'Next.js 14 (App Router)', detail: '服务端组件渲染页面，路由处理器提供数据接口' },
  { name: 'Prisma + MySQL', detail: '类型安全的数据访问，迁移文件随代码入库' },
  { name: 'Tailwind CSS', detail: '手写的编辑风格设计系统，未引入组件库' },
  { name: 'marked + DOMPurify', detail: 'Markdown 服务端渲染，输出经白名单清洗' },
  { name: 'scrypt 会话', detail: 'Node 内置密码哈希 + 数据库会话表' },
]

/**
 * 关于页。
 * 由「居中单列 + 统计卡片 + 接口清单」改为编辑式的非对称版面 ——
 * 左侧是栏目名，右侧是内容；统计不再是盒子，而是一行数字。
 */
export default async function AboutPage() {
  const [stats, admin] = await Promise.all([
    postService.stats(),
    userService.getProfileByUsername('muzzle').catch(() => null),
  ])

  return (
    <div className="shell">
      <header className="border-b border-ink-line py-16 dark:border-night-line lg:py-24">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>关于</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <h1 className="font-serif text-3xl leading-tight sm:text-4xl lg:text-5xl">
              一个用来看和写的地方
            </h1>
            <p className="mt-8 max-w-2xl font-sans text-lg leading-relaxed text-ink-soft dark:text-ink-muted">
              记录工程实践与架构取舍。界面刻意保持克制：没有装饰性动效，
              没有第三方组件库，所有层级靠字号、字重与留白建立。
            </p>
          </div>
        </div>
      </header>

      {/* 统计：一行数字，不做卡片 */}
      <section className="grid gap-6 border-b border-ink-line py-12 dark:border-night-line lg:grid-cols-12">
        <div className="lg:col-span-3">
          <SectionLabel>数字</SectionLabel>
        </div>
        <dl className="grid grid-cols-2 gap-8 lg:col-span-8 lg:col-start-5 sm:grid-cols-4">
          <Stat label="已发布" value={stats.posts} />
          <Stat label="主题" value={stats.tags} />
          <Stat label="评论" value={stats.comments} />
          <Stat label="草稿" value={stats.drafts} />
        </dl>
      </section>

      <section className="grid gap-6 border-b border-ink-line py-12 dark:border-night-line lg:grid-cols-12">
        <div className="lg:col-span-3">
          <SectionLabel>技术栈</SectionLabel>
        </div>
        <ul className="min-w-0 lg:col-span-8 lg:col-start-5">
          {STACK.map((item) => (
            <li
              key={item.name}
              className="flex flex-col gap-1 border-t border-ink-line py-4 first:border-t-0 sm:flex-row sm:items-baseline sm:gap-8 dark:border-night-line"
            >
              <span className="w-56 shrink-0 font-sans text-sm text-ink-strong dark:text-white">
                {item.name}
              </span>
              <span className="font-sans text-sm text-ink-muted dark:text-ink-faint">
                {item.detail}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {admin && (
        <section className="grid gap-6 py-12 lg:grid-cols-12">
          <div className="lg:col-span-3">
            <SectionLabel>作者</SectionLabel>
          </div>
          <div className="min-w-0 lg:col-span-8 lg:col-start-5">
            <Link
              href={`/users/${admin.user.username}`}
              className="font-serif text-2xl text-ink-strong transition-colors hover:text-accent dark:text-white"
            >
              {admin.user.nickname}
            </Link>
            <p className="mt-3 max-w-xl font-sans text-sm leading-relaxed text-ink-soft dark:text-ink-muted">
              {admin.user.bio ?? '这个人很懒，什么都没写。'}
            </p>
            <p className="meta mt-4">
              {admin.postCount} 篇文章 · @{admin.user.username}
            </p>
          </div>
        </section>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dd className="font-serif text-3xl text-ink-strong dark:text-white">{value}</dd>
      <dt className="eyebrow mt-1">{label}</dt>
    </div>
  )
}
