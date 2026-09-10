import { ok, readJson, route } from '@/lib/http'
import { parseOrThrow, updateProfileSchema } from '@/lib/validation'
import { userService } from '@/server/user-service'
import { requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/users/me — 当前登录用户 */
export const GET = route(async (request) => {
  const user = await requireUser(request)
  return ok({ user })
})

/** PATCH /api/users/me — 更新昵称 / 简介 / 邮箱 */
export const PATCH = route(async (request) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(updateProfileSchema, await readJson(request))
  const user = await userService.updateProfile(viewer.id, input)
  return ok({ user })
})
