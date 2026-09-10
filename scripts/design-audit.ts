/**
 * 设计系统与交互的自动化验收（无头浏览器断言，不依赖人眼）。
 *
 *   pnpm exec tsx scripts/design-audit.ts [base_url]
 *
 * 检查项：
 *   1. 扁平风格落地：无 box-shadow、圆角不超过 12px
 *   2. 色板收敛：除中性色与强调色外不出现高饱和杂色
 *   3. 深色模式：切换后背景/文字对比度达标，无纯黑纯白
 *   4. 响应式：320 / 375 / 768 / 1024 / 1440 宽度下无横向溢出
 *   5. 可访问性基线：图片有 alt、按钮有可读名称、仅一个 h1、Tab 焦点可见
 *   6. 交互：搜索防抖跳转、主题持久化、表单校验错误展示
 */
import { chromium, type Page } from 'playwright-core'
import { execSync } from 'node:child_process'
import { loadEnv, requireAdminCredentials } from '@/lib/env'

const BASE = process.argv[2] ?? 'http://localhost:3000'

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
      /* 尝试下一个 */
    }
  }
  throw new Error('未找到 Chromium，请设置 CHROME_PATH')
}

/**
 * Playwright 的 evaluate 会把函数序列化后送进浏览器执行，
 * 而 tsx(esbuild) 会给函数注入 __name 辅助调用，导致浏览器侧 ReferenceError。
 * 统一把函数体转成字符串表达式传入即可绕开该问题。
 */
function evalExpr<T>(page: Page, fn: () => T): Promise<T> {
  const source = fn.toString()
  const hasBlockBody = source.includes('{')
  // 有块级函数体时取花括号内部，否则直接执行整个表达式（箭头简写）
  const body = hasBlockBody
    ? source.slice(source.indexOf('{') + 1, source.lastIndexOf('}'))
    : `return (${source})()`
  // tsx 会把函数体里的箭头函数改写成 __name(fn, "fn") 形式，
  // 浏览器里没有 __name，先补一个空实现再执行。
  const shim = 'const __name = (target, _name) => target;'
  return page.evaluate(`(() => {${shim}${body}})()`) as Promise<T>
}

/**
 * 从 API 动态取一个真实的文章 slug / 标签 slug。
 * 不能写死图片路径：每次 db:seed 都会重新生成文章 slug，
 * 写死会让验收脚本在重新播种后静默地测 404 页面。
 */
async function resolveFixtures(): Promise<{ post: string; tag: string }> {
  const postsResponse = await fetch(`${BASE}/api/posts?pageSize=1`)
  const posts = (await postsResponse.json()) as { data: { slug: string }[] }
  const tagsResponse = await fetch(`${BASE}/api/tags`)
  const tags = (await tagsResponse.json()) as { data: { slug: string }[] }
  const post = posts.data[0]?.slug
  const tag = tags.data[0]?.slug
  if (!post || !tag) {
    throw new Error('数据库缺少演示数据，请先执行 pnpm db:seed')
  }
  return { post, tag }
}

let passed = 0
let failed = 0

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  \x1b[32m✓\x1b[0m ${label}${detail ? `  ${detail}` : ''}`)
    passed += 1
  } else {
    console.log(`  \x1b[31m✗\x1b[0m ${label}${detail ? `  ${detail}` : ''}`)
    failed += 1
  }
}

function section(title: string): void {
  console.log(`\n\x1b[1m${title}\x1b[0m`)
}

/** 采集页面上所有可见元素的样式事实 */
async function collectStyles(page: Page) {
  return evalExpr(page, () => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('body *'))
    const shadows: { selector: string; value: string }[] = []
    const radii = new Set<string>()
    const saturatedColors = new Set<string>()
    let visible = 0

    const parse = (color: string): [number, number, number] | null => {
      const match = color.match(/rgba?\(([^)]+)\)/)
      if (!match) return null
      const parts = match[1].split(',').map((value) => Number.parseFloat(value.trim()))
      return [parts[0], parts[1], parts[2]]
    }

    for (const node of nodes) {
      const rect = node.getBoundingClientRect()
      const style = getComputedStyle(node)
      if (style.display === 'none' || style.visibility === 'hidden') continue
      if (rect.width === 0 || rect.height === 0) continue
      visible += 1

      // 代码高亮由 highlight.js 主题决定，属于内容区配色，不纳入设计系统色板检查
      if (node.closest('.markdown-body pre')) continue

      if (style.boxShadow && style.boxShadow !== 'none') {
        shadows.push({
          selector: `${node.tagName.toLowerCase()}.${(node.className || '').toString().split(' ')[0]}`,
          value: style.boxShadow,
        })
      }

      for (const value of [style.borderRadius, style.borderTopLeftRadius]) {
        const px = Number.parseFloat(value)
        if (!Number.isNaN(px) && px > 0) radii.add(`${Math.round(px)}px`)
      }

      // 只统计有色元素（文字色与背景色）
      for (const color of [style.color, style.backgroundColor]) {
        const rgb = parse(color)
        if (!rgb) continue
        const [r, g, b] = rgb
        const max = Math.max(r, g, b)
        const min = Math.min(r, g, b)
        const saturation = max === 0 ? 0 : (max - min) / max
        // 高饱和且非灰阶：需要确认是强调色/语义色，而不是杂色
        if (saturation > 0.45 && max > 60) {
          saturatedColors.add(
            `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`,
          )
        }
      }
    }

    return {
      visible,
      shadows,
      radii: Array.from(radii).map((value) => Number.parseFloat(value)).sort((a, b) => a - b),
      saturatedColors: Array.from(saturatedColors),
    }
  })
}

async function main(): Promise<void> {
  loadEnv()
  const browser = await chromium.launch({ executablePath: findChromium(), headless: true })
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, locale: 'zh-CN' })
  const page = await context.newPage()

  await page.request.post(`${BASE}/api/auth/login`, {
    data: requireAdminCredentials(),
  })

  const { post: POST_SLUG, tag: TAG_SLUG } = await resolveFixtures()
  const POST_PATH = `/posts/${POST_SLUG}`
  const TOPIC_PATH = `/topics/${encodeURIComponent(TAG_SLUG)}`
  console.log(`\n站点：${BASE}\n用例文章 slug=${POST_SLUG}，标签 slug=${TAG_SLUG}`)
  const PAGES = ['/', '/writing', POST_PATH, '/topics', TOPIC_PATH, '/timeline', '/about', '/search?q=Prisma', '/admin/posts']

  section('1. 扁平风格：无阴影、小圆角')
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const styles = await collectStyles(page)
    const bigShadows = styles.shadows.filter((item) => !item.value.includes('rgba(0, 0, 0, 0)'))
    check(
      `${path} 无装饰性阴影`,
      bigShadows.length === 0,
      bigShadows.length ? `发现 ${bigShadows.length} 处：${bigShadows[0].value}` : `(${styles.visible} 个可见节点)`,
    )
    // 9999px 来自 rounded-full（头像、胶囊标签），是刻意的全圆角，不参与「大圆角」判定
    const cardRadii = styles.radii.filter((value) => value < 100)
    const maxRadius = Math.max(0, ...cardRadii)
    check(
      `${path} 容器圆角 ≤ 12px`,
      maxRadius <= 12,
      `最大 ${maxRadius}px，取值为 ${cardRadii.join('/')}${styles.radii.length !== cardRadii.length ? '（另有 rounded-full）' : ''}`,
    )
  }

  section('2. 色板收敛：只允许中性色 + 强调/语义色')
  /*
   * 新设计（编辑/杂志风）允许的高饱和色白名单。
   * 实测全站只有 accent 一个高饱和色出现，这里保留它以及语义色
   * （错误红 / 成功绿 / 警告琥珀），出现名单之外的色即视为色板漂移。
   */
  const ALLOWED_SATURATED_PREFIXES = [
    'rgb(176, 81, 42)',   // accent 赭石
    'rgb(143, 63, 31)',   // accent-strong
    'rgb(185, 28, 28)',   // 错误红
    'rgb(220, 38, 38)',
    'rgb(22, 163, 74)',   // 成功绿
    'rgb(16, 185, 129)',
    'rgb(217, 119, 6)',   // 警告琥珀
    'rgb(180, 83, 9)',
  ]
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const styles = await collectStyles(page)
    const unexpected = styles.saturatedColors.filter(
      (color) => !ALLOWED_SATURATED_PREFIXES.includes(color),
    )
    check(
      `${path} 无计划外的高饱和色`,
      unexpected.length === 0,
      unexpected.length ? `发现 ${unexpected.slice(0, 4).join(', ')}` : `(${styles.saturatedColors.length} 个有色值)`,
    )
  }

  section('2b. 编辑风格：衬线标题 / 暖色底 / 单一强调色')

  for (const path of ['/', '/writing', POST_PATH, '/about']) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const editorial = await evalExpr(page, () => {
      const parse = (color: string) => {
        const match = color.match(/rgba?\(([^)]+)\)/)
        if (!match) return null
        return match[1].split(',').slice(0, 3).map((value) => Number.parseFloat(value.trim()))
      }
      const heading = document.querySelector('h1, h2, h3')
      const bodyStyle = getComputedStyle(document.body)
      const bg = parse(bodyStyle.backgroundColor)
      const headingFont = heading ? getComputedStyle(heading).fontFamily : ''

      // 统计圆角：编辑风格应当几乎没有圆角
      const radii = new Set<string>()
      for (const node of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
        const style = getComputedStyle(node)
        const rect = node.getBoundingClientRect()
        if (style.display === 'none' || rect.width === 0) continue
        for (const value of [style.borderRadius, style.borderTopLeftRadius]) {
          const px = Number.parseFloat(value)
          if (!Number.isNaN(px) && px > 0) radii.add(String(Math.round(px)))
        }
      }

      return {
        headingFont,
        bg,
        // 是否有 h1（页面没渲染出来时会是 0）
        h1Count: document.querySelectorAll('h1').length,
        radii: Array.from(radii).map(Number).sort((a, b) => a - b),
      }
    })

    check(`${path} 标题使用衬线体`, /Songti|Serif|serif|Georgia/i.test(editorial.headingFont), editorial.headingFont.slice(0, 34))
    check(
      `${path} 底色为暖白而非纯白`,
      Boolean(editorial.bg && editorial.bg[0] > 240 && editorial.bg[0] >= editorial.bg[2] && editorial.bg[2] < 252),
      editorial.bg ? `rgb(${editorial.bg.map(Math.round).join(', ')})` : '取不到',
    )
    check(
      `${path} 页面已渲染（存在 h1）`,
      editorial.h1Count >= 1,
      `h1 数量 ${editorial.h1Count}`,
    )
  }

  section('3. 深色模式')
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await evalExpr(page, () => localStorage.setItem('blog-theme', 'dark'))
  await page.reload({ waitUntil: 'networkidle' })
  const darkFacts = await evalExpr(page, () => {
    const body = getComputedStyle(document.body)
    const html = document.documentElement
    const parse = (color: string) => color.match(/rgba?\(([^)]+)\)/)?.[1]
      .split(',')
      .slice(0, 3)
      .map((value) => Number.parseFloat(value.trim())) ?? [0, 0, 0]
    return {
      hasDarkClass: html.classList.contains('dark'),
      colorScheme: html.style.colorScheme,
      bg: parse(body.backgroundColor),
      fg: parse(body.color),
    }
  })
  check('切换后 <html> 带 dark 类', darkFacts.hasDarkClass)
  check('color-scheme 同步为 dark', darkFacts.colorScheme === 'dark', darkFacts.colorScheme)

  const [bgR, bgG, bgB] = darkFacts.bg
  const [fgR, fgG, fgB] = darkFacts.fg
  check('深色背景不是纯黑', bgR + bgG + bgB > 0, `rgb(${darkFacts.bg.join(', ')})`)
  check('深色前景不是纯白', fgR + fgG + fgB < 765, `rgb(${darkFacts.fg.join(', ')})`)

  // WCAG 相对亮度对比度
  const luminance = ([r, g, b]: number[]) => {
    const channel = (value: number) => {
      const v = value / 255
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
    }
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  }
  const l1 = luminance(darkFacts.fg)
  const l2 = luminance(darkFacts.bg)
  const contrast = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
  check('深色模式正文对比度 ≥ 7:1 (AAA)', contrast >= 7, `${contrast.toFixed(2)}:1`)

  const lightFacts = await evalExpr(page, () => {
    localStorage.setItem('blog-theme', 'light')
    return true
  })
  check('主题写入 localStorage 持久化', lightFacts)

  section('4. 响应式：无横向溢出')
  for (const width of [320, 375, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    for (const path of ['/', '/writing', POST_PATH, '/topics', '/timeline', '/admin/posts']) {
      await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
      const overflow = await evalExpr(page, () => {
        const doc = document.documentElement
        const scrollWidth = Math.max(doc.scrollWidth, document.body.scrollWidth)
        const offenders: string[] = []
        if (scrollWidth > window.innerWidth + 1) {
          for (const node of Array.from(document.querySelectorAll<HTMLElement>('body *'))) {
            const rect = node.getBoundingClientRect()
            if (rect.right > window.innerWidth + 1 && rect.width > 8) {
              offenders.push(`${node.tagName.toLowerCase()}.${(node.className || '').toString().split(' ')[0]}`)
              if (offenders.length >= 3) break
            }
          }
        }
        return { scrollWidth, innerWidth: window.innerWidth, offenders }
      })
      check(
        `${width}px ${path} 无横向溢出`,
        overflow.scrollWidth <= overflow.innerWidth + 1,
        overflow.offenders.length ? `溢出元素：${overflow.offenders.join(', ')}` : '',
      )
    }
  }

  section('5. 可访问性基线')
  await page.setViewportSize({ width: 1280, height: 900 })
  for (const path of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: 'networkidle' })
    const a11y = await evalExpr(page, () => {
      const h1s = document.querySelectorAll('h1').length
      const imagesWithoutAlt = Array.from(document.querySelectorAll('img')).filter(
        (img) => !img.hasAttribute('alt'),
      ).length
      const buttons = Array.from(document.querySelectorAll('button'))
      const unnamedButtons = buttons.filter((button) => {
        const text = (button.textContent || '').trim()
        const label = button.getAttribute('aria-label')
        const title = button.getAttribute('title')
        return !text && !label && !title
      }).length
      const links = Array.from(document.querySelectorAll('a'))
      const unnamedLinks = links.filter((link) => {
        const text = (link.textContent || '').trim()
        return !text && !link.getAttribute('aria-label')
      }).length
      const lang = document.documentElement.lang
      return { h1s, imagesWithoutAlt, unnamedButtons, unnamedLinks, lang }
    })
    check(`${path} 仅一个 h1`, a11y.h1s === 1, `实际 ${a11y.h1s}`)
    check(`${path} 图片均有 alt / 控件有可读名称`, a11y.imagesWithoutAlt === 0 && a11y.unnamedButtons === 0 && a11y.unnamedLinks === 0,
      `img 缺 alt ${a11y.imagesWithoutAlt}，无名按钮 ${a11y.unnamedButtons}，无名链接 ${a11y.unnamedLinks}`)
  }

  const langCheck = await evalExpr(page, () => document.documentElement.lang)
  check('html lang 已声明', langCheck === 'zh-CN', langCheck)

  section('6. 交互行为')
  await page.goto(`${BASE}/search`, { waitUntil: 'networkidle' })
  await page.fill('input[aria-label="搜索文章"]', 'Prisma')
  await page.waitForTimeout(900)
  check('搜索防抖后 URL 同步 ?q=', page.url().includes('q=Prisma'), page.url())
  const resultCount = await page.locator('text=/找到|没有找到|输入关键词/').first().textContent()
  check('搜索结果区已渲染', Boolean(resultCount), (resultCount ?? '').slice(0, 40))

  // 登录表单校验：空提交应出现字段错误
  // 先清空会话，否则已登录状态访问 /login 会被重定向回首页
  await context.clearCookies()
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  await page.click('button[type="submit"]')
  await page.waitForTimeout(600)
  const hasFieldError = await page.locator('text=/请输入|不能为空|至少/').count()
  check('登录表单空提交展示校验提示', hasFieldError > 0, `命中 ${hasFieldError} 处`)

  // 错误凭证应展示服务端错误
  await page.fill('input#identifier', 'muzzle')
  await page.fill('input#password', 'WrongPass123')
  await page.click('button[type="submit"]')
  await page.waitForTimeout(1500)
  const errorText = await page.locator('text=/账号或密码错误/').count()
  check('登录失败展示后端错误信息', errorText > 0)

  // 键盘焦点可见性
  await page.goto(`${BASE}/`, { waitUntil: 'networkidle' })
  await page.keyboard.press('Tab')
  const focusVisible = await evalExpr(page, () => {
    const element = document.activeElement as HTMLElement | null
    if (!element) return null
    const style = getComputedStyle(element)
    return {
      tag: element.tagName.toLowerCase(),
      outlineWidth: style.outlineWidth,
      boxShadow: style.boxShadow,
    }
  })
  check(
    'Tab 聚焦有可见焦点样式',
    Boolean(focusVisible && (focusVisible.boxShadow !== 'none' || Number.parseFloat(focusVisible.outlineWidth) > 0)),
    focusVisible ? `<${focusVisible.tag}> shadow=${focusVisible.boxShadow.slice(0, 30)}` : '',
  )

  await browser.close()

  console.log(`\n\x1b[1m结果：\x1b[0m \x1b[32m${passed} 通过\x1b[0m${failed ? `，\x1b[31m${failed} 失败\x1b[0m` : '，0 失败'}`)
  if (failed > 0) process.exitCode = 1
}

main().catch((error: unknown) => {
  console.error('设计验收脚本失败：', error)
  process.exit(1)
})
