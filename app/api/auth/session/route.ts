import { noContent, route } from '@/lib/http'
import { clearSessionCookie, destroySession, getSessionTokenFromRequest } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** DELETE /api/auth/session — 退出登录（幂等，未登录也返回 204） */
export const DELETE = route(async (request) => {
  await destroySession(getSessionTokenFromRequest(request))
  const response = noContent()
  clearSessionCookie(response)
  return response
})
