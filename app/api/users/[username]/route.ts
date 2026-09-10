import { ok, route } from '@/lib/http'
import { userService } from '@/server/user-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/users/:username — 公开用户资料与已发布文章数 */
export const GET = route(async (_request, { params }: { params: { username: string } }) => {
  const profile = await userService.getProfileByUsername(params.username)
  return ok(profile)
})
