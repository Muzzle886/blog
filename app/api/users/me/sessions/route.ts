import { ok, route } from '@/lib/http'
import { hashSessionToken } from '@/lib/crypto'
import {
  destroyOtherSessions,
  getSessionTokenFromRequest,
  listSessions,
  requireUser,
} from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/users/me/sessions — 列出当前账号的有效登录会话
 *
 * 返回的 id 是会话令牌的摘要，不是令牌本身 ——
 * 因此即便这个响应被泄露，也无法用来冒充登录。
 */
export const GET = route(async (request) => {
  const viewer = await requireUser(request)
  const token = getSessionTokenFromRequest(request)
  const currentId = token ? hashSessionToken(token) : null

  const sessions = await listSessions(viewer.id)
  return ok(
    sessions.map((session) => ({
      id: session.id,
      current: session.id === currentId,
      /*
       * userAgent / ip 是**登录时记录的原始值，未经校验**：
       * 请求头由客户端控制，x-forwarded-for 也可能被伪造（除非位于
       * 会剥离该头的可信反向代理之后）。它们只适合作为「这是不是我
       * 熟悉的设备」的粗略参考，不能用于任何安全判定 ——
       * 字段名如实反映这一点。
       */
      recordedUserAgent: session.userAgent,
      recordedIp: session.ip,
      createdAt: session.createdAt.toISOString(),
      lastUsedAt: session.lastUsedAt.toISOString(),
      expiresAt: session.expiresAt.toISOString(),
    })),
  )
})

/** DELETE /api/users/me/sessions — 退出其它所有设备（保留当前会话） */
export const DELETE = route(async (request) => {
  const viewer = await requireUser(request)
  const token = getSessionTokenFromRequest(request)
  const revoked = await destroyOtherSessions(token, viewer.id)
  return ok({ revokedSessions: revoked })
})
