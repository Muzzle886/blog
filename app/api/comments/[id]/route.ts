import { noContent, route } from '@/lib/http'
import { idParamSchema, parseOrThrow } from '@/lib/validation'
import { commentService } from '@/server/comment-service'
import { requireUser } from '@/lib/auth'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** DELETE /api/comments/:id — 删除评论（作者本人 / 文章作者 / 管理员） */
export const DELETE = route(async (request, { params }: { params: { id: string } }) => {
  const viewer = await requireUser(request)
  const { id } = parseOrThrow(idParamSchema, params)
  await commentService.remove(id, viewer)
  return noContent()
})
