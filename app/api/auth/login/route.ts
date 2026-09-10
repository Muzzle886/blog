import { ok, readJson, route } from '@/lib/http'
import { loginSchema, parseOrThrow } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/auth/login — 登录，签发 httpOnly 会话 Cookie */
export const POST = route(async (request) => {
  const input = parseOrThrow(loginSchema, await readJson(request))
  const user = await userService.authenticate(input.identifier, input.password)

  const response = ok({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  })
  return response
})
