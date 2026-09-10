import { ok, readJson, route } from '@/lib/http'
import { changePasswordSchema, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { destroySession, getSessionIdFromRequest, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** PATCH /api/users/me/password — 修改密码，并注销当前会话（强制重新登录） */
export const PATCH = route(async (request) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(changePasswordSchema, await readJson(request))
  await userService.changePassword(viewer.id, input.currentPassword, input.newPassword)
  // 改密后失效当前会话，前端需重新登录
  await destroySession(getSessionIdFromRequest(request))
  return ok({ reauthRequired: true })
})
