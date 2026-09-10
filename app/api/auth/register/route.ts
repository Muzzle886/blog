import { created, readJson, route } from '@/lib/http'
import { parseOrThrow, registerSchema } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'
import { RateLimit, clientIp, enforce } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * POST /api/auth/register — 注册并直接登录
 *
 * 按来源 IP 限流，防止批量注册。
 *
 * 关于「账号枚举」：注册接口会明确告知是用户名还是邮箱冲突（409），
 * 这是刻意的取舍 —— 注册场景下用户必须知道哪个字段冲突才能继续操作。
 * 账号枚举的主要风险面在登录侧，那里已统一为「账号或密码错误」。
 */
export const POST = route(async (request) => {
  const ip = clientIp(request)
  enforce(`register:ip:${ip}`, RateLimit.register)

  const input = parseOrThrow(registerSchema, await readJson(request))
  const user = await userService.register(input)

  const response = created({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip,
  })
  return response
})
