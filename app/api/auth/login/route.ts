import { ok, readJson, route } from '@/lib/http'
import { loginSchema, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'
import { RateLimit, clientIp, enforce } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/login — 登录，签发 httpOnly 会话 Cookie
 *
 * 限流分两个维度：
 *  - 按「账号」：挡住针对某个账号的定向撞库
 *  - 按「来源 IP」：挡住拿一堆账号广撒网的撞库
 * 每次尝试都要跑一次 scrypt（约 200ms / 134MB 内存），不限流的话
 * 登录接口本身就是一个廉价的资源耗尽入口。
 */
export const POST = route(async (request) => {
  const ip = clientIp(request)
  const input = parseOrThrow(loginSchema, await readJson(request))

  enforce(`login:ip:${ip}`, RateLimit.loginByIp)
  enforce(`login:acct:${input.identifier.toLowerCase()}`, RateLimit.login)

  const user = await userService.authenticate(input.identifier, input.password)

  const response = ok({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip,
  })
  return response
})
