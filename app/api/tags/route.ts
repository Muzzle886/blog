import { ok, route } from '@/lib/http'
import { tagService } from '@/server/tag-service'
import { postService } from '@/server/post-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/tags — 标签列表（带已发布文章数），供侧边栏与标签页使用
 * GET /api/tags?include=stats 时附带站点统计
 */
export const GET = route(async (request) => {
  const url = new URL(request.url)
  const tags = await tagService.list()
  if (url.searchParams.get('include') === 'stats') {
    return ok(tags, { stats: await postService.stats() })
  }
  return ok(tags)
})
