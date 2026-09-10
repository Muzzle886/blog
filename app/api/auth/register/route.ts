import { created, readJson, route } from '@/lib/http'
import { parseOrThrow, registerSchema } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { createSessionForUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** POST /api/auth/register — 注册并直接登录 */
export const POST = route(async (request) => {
  const input = parseOrThrow(registerSchema, await readJson(request))
  const user = await userService.register(input)

  const response = created({ user })
  await createSessionForUser(response, user.id, {
    userAgent: request.headers.get('user-agent'),
    ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
  })
  return response
})
