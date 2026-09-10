import { ok, route } from '@/lib/http'
import { clearSessionCookie, destroySession, getSessionTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/auth/session — 退出登录（幂等，未登录也返回成功）
 *
 * 返回 200 + 响应体而不是 204：调用方总是需要知道「是否真的清掉了会话」，
 * 一个空响应体会让前端只能靠状态码猜。
 */
export const DELETE = route(async (request) => {
  const token = getSessionTokenFromRequest(request)
  const loggedOut = Boolean(token)
  await destroySession(token)

  const response = ok({ loggedOut })
  clearSessionCookie(response)
  return response
})
