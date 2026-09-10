/**
 * 视觉验收脚本：用无头浏览器逐页截图，并收集控制台错误与页面异常。
 *
 *   pnpm exec tsx scripts/screenshot.ts [base_url] [out_dir]
 *
 * 截图产物写入 .screenshots/（已 gitignore），用于人工核对极简扁平风格是否落地。
 */
import { chromium, type ConsoleMessage } from 'playwright-core'
import { mkdirSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { resolve } from 'node:path'
import { loadEnv, requireAdminCredentials } from '@/lib/env'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const OUT = resolve(process.cwd(), process.argv[3] ?? '.screenshots')

function findChromium(): string {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    `${process.env.HOME}/Library/Caches/ms-playwright/chromium-1234/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing`,
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  for (const candidate of candidates) {
    try {
      execSync(`test -x "${candidate}"`)
      return candidate
    } catch {
      /* 继续尝试下一个 */
    }
  }
  throw new Error('未找到可用的 Chromium，请设置 CHROME_PATH')
}

/** 动态解析演示文章 slug（每次播种都会变，写死会截到 404 页） */
async function resolvePostSlug(): Promise<string> {
  const response = await fetch(`${BASE}/api/posts?pageSize=1`)
  const payload = (await response.json()) as { data: { slug: string }[] }
  const slug = payload.data[0]?.slug
  if (!slug) throw new Error('数据库缺少演示数据，请先执行 pnpm db:seed')
  return slug
}

interface Shot {
  name: string
  path: string
  /** 登录态截图 */
  auth?: boolean
  fullPage?: boolean
  waitFor?: string
  /** 使用深色主题截图 */
  dark?: boolean
}

/** 文章路径占位符：真实 slug 在运行时解析后替换 */
const POST_PATH_PLACEHOLDER = '__POST__'

const SHOTS: Shot[] = [
  { name: '01-home-light', path: '/', fullPage: true },
  { name: '02-post-detail', path: POST_PATH_PLACEHOLDER, fullPage: true },
  { name: '03-tags', path: '/tags' },
  { name: '04-archive', path: '/archive' },
  { name: '05-search', path: '/search?q=Prisma' },
  { name: '06-about', path: '/about', fullPage: true },
  { name: '07-login', path: '/login' },
  { name: '08-register', path: '/register' },
  { name: '09-profile', path: '/users/muzzle' },
  { name: '10-404', path: '/posts/nope-not-here' },
  { name: '11-admin-posts', path: '/admin/posts', auth: true },
  { name: '12-editor', path: '/write', auth: true, waitFor: 'textarea' },
  { name: '13-settings', path: '/settings', auth: true },
  { name: '14-home-dark', path: '/', dark: true },
  { name: '15-post-dark', path: POST_PATH_PLACEHOLDER, dark: true },
  { name: '16-tags-dark', path: '/tags', dark: true },
]

async function main(): Promise<void> {
  loadEnv()
  mkdirSync(OUT, { recursive: true })
  const postSlug = await resolvePostSlug()

  const browser = await chromium.launch({ executablePath: findChromium(), headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 2,
    locale: 'zh-CN',
  })

  const problems: string[] = []
  context.on('weberror', (error) => problems.push(`[pageerror] ${error.error().message}`))

  const page = await context.newPage()
  page.on('console', (message: ConsoleMessage) => {
    if (message.type() === 'error') problems.push(`[console] ${message.text()}`)
  })

  // 先登录，拿到会话 Cookie 供后续 auth 截图使用
  const loginResponse = await page.request.post(`${BASE}/api/auth/login`, {
    data: requireAdminCredentials(),
  })
  if (!loginResponse.ok()) {
    console.warn(`⚠ 登录失败（${loginResponse.status()}），受保护页面截图将重定向到登录页`)
  }

  for (const shot of SHOTS) {
    const url = `${BASE}${shot.path.replace(POST_PATH_PLACEHOLDER, `/posts/${postSlug}`)}`
    const file = resolve(OUT, `${shot.name}.png`)

    if (shot.dark) {
      await page.addInitScript(() => localStorage.setItem('blog-theme', 'dark'))
    } else {
      await page.addInitScript(() => localStorage.setItem('blog-theme', 'light'))
    }

    try {
      await page.goto(url, { waitUntil: 'networkidle', timeout: 45_000 })
      if (shot.waitFor) {
        await page.waitForSelector(shot.waitFor, { timeout: 15_000 }).catch(() => undefined)
      }
      await page.waitForTimeout(400)
      await page.screenshot({ path: file, fullPage: Boolean(shot.fullPage) })

      const title = await page.title()
      const status = await page.evaluate(() => document.readyState)
      console.log(`✓ ${shot.name.padEnd(18)} ${url}`)
      console.log(`  title="${title}" readyState=${status}`)
    } catch (error) {
      console.error(`✗ ${shot.name} 截图失败：`, error instanceof Error ? error.message : error)
      problems.push(`[screenshot:${shot.name}] ${String(error)}`)
    }
  }

  await browser.close()

  console.log(`\n截图输出目录：${OUT}`)
  if (problems.length > 0) {
    console.log(`\n发现 ${problems.length} 个问题：`)
    for (const problem of Array.from(new Set(problems))) console.log(`  - ${problem}`)
    process.exitCode = 1
  } else {
    console.log('\n✓ 所有页面无控制台错误')
  }
}

main().catch((error: unknown) => {
  console.error('截图脚本失败：', error)
  process.exit(1)
})
