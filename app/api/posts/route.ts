import { created, ok, readJson, route, searchParamsToObject } from '@/lib/http'
import { parseOrThrow, postCreateSchema, postQuerySchema } from '@/lib/validation'
import { postService } from '@/server/post-service'
import { getCurrentUser, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/posts — 文章列表
 * Query: page, pageSize, q, tag, author, status(PUBLISHED|DRAFT|ALL), sort(latest|oldest|popular)
 */
export const GET = route(async (request) => {
  const query = parseOrThrow(postQuerySchema, searchParamsToObject(request.url))
  const viewer = await getCurrentUser()
  const { items, meta } = await postService.list(query, viewer)
  return ok(items, { pagination: meta })
})

/** POST /api/posts — 新建文章（草稿或直接发布） */
export const POST = route(async (request) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(postCreateSchema, await readJson(request))
  const post = await postService.create(input, viewer)
  return created(post)
})
