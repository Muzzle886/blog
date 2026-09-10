import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'blog_session'
const IS_DEV = process.env.NODE_ENV !== 'production'

/**
 * 受保护页面的第一道闸门。
 *
 * 在 Edge 上只做「是否携带会话 Cookie」的判断，命中就直接返回 307，
 * 避免未登录用户先渲染出受保护页面再靠客户端跳转（会出现内容闪现）。
 *
 * 真正的权限判定（会话是否有效、是否过期、资源归属）依然在服务端组件与
 * API 路由中完成 —— 这里只是廉价的前置拦截。
 */
const PROTECTED_PREFIXES = ['/write', '/admin', '/settings']

/**
 * 每次请求生成 nonce，并据此下发 CSP。
 *
 * 为什么用 nonce 而不是 'unsafe-inline'：Next.js 的 hydration 数据与主题
 * 初始化脚本都是内联 <script>，用 unsafe-inline 等于把 CSP 对 XSS 的防护
 * 基本让掉。nonce 方案下只有带正确 nonce 的脚本能执行。
 *
 * 注意 style-src 仍需 'unsafe-inline'：Next.js 会注入内联 <style>，
 * 而 style 注入的危害远小于 script。
 */
function buildCsp(nonce: string): string {
  /*
   * 开发模式下不用 nonce，改用 'unsafe-inline'。
   *
   * 原因：Next 在 dev 下不会把 nonce 注入客户端 bundle，服务端渲染出
   * nonce="" 而客户端拿到真实 nonce，React 会对每一个脚本报
   * "Prop `nonce` did not match" —— 几十条噪声，会淹没真正有用的告警，
   * 也会让截图/审计脚本把控制台刷满。
   * dev 的 CSP 本来就必须放行 'unsafe-eval'（React Refresh 需要），
   * 安全性已经不是防线，因此这里选择"干净"而不是"看起来严格"。
   * 生产环境仍然走 nonce + strict-dynamic。
   */
  const scriptSrc = IS_DEV
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`

  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ')
}

/** 所有响应都下发的通用响应头 */
function applyCommonHeaders(response: NextResponse, nonce: string): void {
  response.headers.set('Content-Security-Policy', buildCsp(nonce))
  // 阻止浏览器按内容嗅探 MIME 类型
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // 禁止被 iframe 嵌套，防御点击劫持（与 CSP frame-ancestors 双重保险）
  response.headers.set('X-Frame-Options', 'DENY')
  // 跨站跳转时不泄露完整 URL（可能含 slug 等信息）
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // 本站不需要这些能力，直接关掉
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  // 关闭旧版浏览器上的 XSS 过滤器（它自身反而可能被利用）
  response.headers.set('X-XSS-Protection', '0')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const nonce = crypto.randomUUID().replace(/-/g, '')

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  // 未登录访问受保护页面：直接 307，不渲染任何受保护内容
  if (isProtected && !request.cookies.has(COOKIE_NAME)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    applyCommonHeaders(redirectResponse, nonce)
    return redirectResponse
  }

  // 把 nonce 透传给服务端组件，供内联脚本（如主题初始化）使用
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-nonce', nonce)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  applyCommonHeaders(response, nonce)

  // HSTS：仅在确实走 HTTPS 时才下发，否则本地开发会强制跳 https
  if (request.nextUrl.protocol === 'https:') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    )
  }

  return response
}

export const config = {
  /*
   * 覆盖所有页面与 API 路由（要让每个响应都带上安全头），
   * 但排除静态资源，避免给图片/字体也生成 nonce。
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|sitemap.xml).*)',
  ],
}
