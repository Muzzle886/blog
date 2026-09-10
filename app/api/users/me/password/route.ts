import { ok, readJson, route } from '@/lib/http'
import { changePasswordSchema, decryptAndValidateNewPassword, decryptField, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { clearSessionCookie, destroyAllSessions, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * PATCH /api/users/me/password — 修改密码
 *
 * 两个口令都以密文提交，解密后再校验。成功后撤销该用户的**全部**会话
 * （含其它设备）—— 若只注销当前会话，账号被盗后受害者改密码并不能
 * 把攻击者踢下线。
 */
export const PATCH = route(async (request) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(changePasswordSchema, await readJson(request))

  const currentPassword = decryptField(input.currentPassword, 'currentPassword')
  const newPassword = decryptAndValidateNewPassword(input.newPassword, 'newPassword')

  await userService.changePassword(viewer.id, currentPassword, newPassword)

  const revoked = await destroyAllSessions(viewer.id)

  const response = ok({ reauthRequired: true, revokedSessions: revoked })
  clearSessionCookie(response)
  return response
})
