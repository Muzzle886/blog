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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
  if (!isProtected) return NextResponse.next()

  if (request.cookies.has(COOKIE_NAME)) return NextResponse.next()

  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', pathname)
  return NextResponse.redirect(loginUrl)
}

export const config = {
  // 排除 API 路由与静态资源，只拦截页面请求
  matcher: ['/write/:path*', '/admin/:path*', '/settings/:path*'],
}
