import { ok, readJson, route } from '@/lib/http'
import { decryptField, loginSchema, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'
import { RateLimit, clientIp, enforce } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login — 登录，签发 httpOnly 会话 Cookie
 *
 * 口令以 RSA-OAEP 密文提交，这里先解密再比对，因此请求体里不含明文。
 * 限流分两个维度：按账号（挡定向撞库）与按来源 IP（挡广撒网）。
 * 每次尝试都要跑一次 scrypt，不限流的话登录接口本身就是资源耗尽入口。
 */
export const POST = route(async (request) => {
  const ip = clientIp(request)
  const input = parseOrThrow(loginSchema, await readJson(request))

  enforce(`login:ip:${ip}`, RateLimit.loginByIp)
  enforce(`login:acct:${input.identifier.toLowerCase()}`, RateLimit.login)

  const password = decryptField(input.password, 'password')
  const user = await userService.authenticate(input.identifier, password)

  const response = ok({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip,
  })
  return response
})
