import { created, ok, readJson, route, searchParamsToObject } from '@/lib/http'
import { commentCreateSchema, commentQuerySchema, parseOrThrow } from '@/lib/validation'
import { commentService } from '@/server/comment-service'
import { getCurrentUser, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { slug: string } }

/**
 * GET /api/posts/:slug/comments — 评论列表（游标分页）
 * Query: cursor, limit
 */
export const GET = route(async (request, { params }: Ctx) => {
  const query = parseOrThrow(commentQuerySchema, searchParamsToObject(request.url))
  const viewer = await getCurrentUser()
  const { items, meta } = await commentService.listByPostSlug(params.slug, query, viewer)
  return ok(items, { cursor: meta })
})

/** POST /api/posts/:slug/comments — 发表评论 / 回复 */
export const POST = route(async (request, { params }: Ctx) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(commentCreateSchema, await readJson(request))
  const comment = await commentService.create(params.slug, input, viewer)
  return created(comment)
})
