import { ok, readJson, route } from '@/lib/http'
import { changePasswordSchema, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { clearSessionCookie, destroyAllSessions, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/me/password — 修改密码
 *
 * 成功后撤销该用户的**全部**会话（含其它设备），而不只是当前会话。
 * 这是关键语义：若只注销当前会话，账号被盗后受害者改密码并不能
 * 把攻击者踢下线，攻击者的会话会一直有效到绝对过期。
 */
export const PATCH = route(async (request) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(changePasswordSchema, await readJson(request))

  await userService.changePassword(viewer.id, input.currentPassword, input.newPassword)

  const revoked = await destroyAllSessions(viewer.id)

  const response = ok({ reauthRequired: true, revokedSessions: revoked })
  clearSessionCookie(response)
  return response
})
