import { noContent, ok, readJson, route } from '@/lib/http'
import { parseOrThrow, postUpdateSchema } from '@/lib/validation'
import { postService } from '@/server/post-service'
import { getCurrentUser, requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Ctx = { params: { slug: string } }

/**
 * GET /api/posts/:slug — 文章详情
 * Query: ?view=edit 时返回可编辑内容（草稿也可读，仅作者/管理员）
 */
export const GET = route(async (request, { params }: Ctx) => {
  const viewer = await getCurrentUser()
  const url = new URL(request.url)

  if (url.searchParams.get('view') === 'edit') {
    const me = await requireUser(request)
    return ok(await postService.getForEdit(params.slug, me))
  }
  return ok(await postService.getBySlug(params.slug, viewer, { incrementViews: true }))
})

/** PATCH /api/posts/:slug — 局部更新（标题/正文/摘要/标签/发布状态） */
export const PATCH = route(async (request, { params }: Ctx) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(postUpdateSchema, await readJson(request))
  return ok(await postService.update(params.slug, input, viewer))
})

/** PUT /api/posts/:slug — 全量替换，语义等价于 PATCH 但要求必填字段齐全 */
export const PUT = route(async (request, { params }: Ctx) => {
  const viewer = await requireUser(request)
  const input = parseOrThrow(postUpdateSchema, await readJson(request))
  return ok(await postService.update(params.slug, input, viewer))
})

/** DELETE /api/posts/:slug — 软删除 */
export const DELETE = route(async (request, { params }: Ctx) => {
  const viewer = await requireUser(request)
  await postService.remove(params.slug, viewer)
  return noContent()
})
