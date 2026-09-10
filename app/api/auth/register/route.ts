import { created, readJson, route } from '@/lib/http'
import { decryptAndValidateNewPassword, parseOrThrow, registerSchema } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'
import { RateLimit, clientIp, enforce } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register — 注册并直接登录
 *
 * 口令以密文提交，解密后再按强度规则校验（至少 8 位、含字母与数字），
 * 因此请求体里不含明文口令。按来源 IP 限流，防止批量注册。
 */
export const POST = route(async (request) => {
  const ip = clientIp(request)
  enforce(`register:ip:${ip}`, RateLimit.register)

  const input = parseOrThrow(registerSchema, await readJson(request))
  const password = decryptAndValidateNewPassword(input.password, 'password')

  const user = await userService.register({
    username: input.username,
    email: input.email,
    nickname: input.nickname,
    password,
  })

  const response = created({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip,
  })
  return response
})
