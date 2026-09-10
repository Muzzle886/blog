import { ok, route } from '@/lib/http'
import { postService } from '@/server/post-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** GET /api/stats — 站点统计（文章数 / 草稿数 / 标签数 / 评论数） */
export const GET = route(async () => {
  return ok(await postService.stats())
})
