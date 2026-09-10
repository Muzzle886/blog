import { ok, route } from '@/lib/http'
import { idParamSchema, parseOrThrow } from '@/lib/validation'
import { commentService } from '@/server/comment-service'
import { requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * DELETE /api/comments/:id — 删除评论（作者本人 / 文章作者 / 管理员）
 * 成功返回 200 + { id, deleted: true }，与删除文章的响应结构保持一致。
 */
export const DELETE = route(async (request, { params }: { params: { id: string } }) => {
  const viewer = await requireUser(request)
  const { id } = parseOrThrow(idParamSchema, params)
  await commentService.remove(id, viewer)
  return ok({ id, deleted: true })
})
