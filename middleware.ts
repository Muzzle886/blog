import { NextResponse, type NextRequest } from 'next/server'

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'blog_session'

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
 * 响应头。
 *
 * 说明：这里**不下发 CSP**。之前实现过 nonce + strict-dynamic 的方案，
 * 但它带来了一连串副作用（dev 下 Next 不把 nonce 注入客户端 bundle，
 * 导致每个脚本都报属性不匹配；主题脚本要专门为它串 nonce；
 * 验收脚本还要按环境区分断言），而收益在当前阶段用不上。
 * 其余几项响应头没有这类副作用，保留：
 */
function applyCommonHeaders(response: NextResponse): void {
  // 阻止浏览器按内容嗅探 MIME 类型
  response.headers.set('X-Content-Type-Options', 'nosniff')
  // 禁止被 iframe 嵌套，防御点击劫持
  response.headers.set('X-Frame-Options', 'DENY')
  // 跨站跳转时不泄露完整 URL
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  // 本站不需要这些能力
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  // 关闭旧版浏览器上的 XSS 过滤器（它自身反而可能被利用）
  response.headers.set('X-XSS-Protection', '0')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )

  // 未登录访问受保护页面：直接 307，不渲染任何受保护内容
  if (isProtected && !request.cookies.has(COOKIE_NAME)) {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('redirect', pathname)
    const redirectResponse = NextResponse.redirect(loginUrl)
    applyCommonHeaders(redirectResponse)
    return redirectResponse
  }

  const response = NextResponse.next()
  applyCommonHeaders(response)

  // HSTS：仅在确实走 HTTPS 时才下发，否则本地开发会被强制跳 https
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
   * 但排除静态资源。
   */
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|logo.svg|robots.txt|sitemap.xml).*)',
  ],
}
