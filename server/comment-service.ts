import 'server-only'
import { prisma } from '@/lib/prisma'
import { forbidden, notFound } from '@/lib/errors'
import { toCommentItem } from '@/lib/serializers'
import type { CommentItem, CursorMeta, PublicUser } from '@/lib/types'
import { visibilityWhere } from './post-service'

export interface ListCommentsInput {
  cursor?: number
  limit: number
}

/**
 * 评论服务。
 *  - 采用「游标分页」而非页码：评论会实时新增，页码分页会导致翻页时数据漂移
 *  - 顶层评论分页返回；回复（replies）随顶层评论一次性返回，避免 N+1 请求
 */
export const commentService = {
  async listByPostSlug(
    slug: string,
    input: ListCommentsInput,
    viewer?: PublicUser | null,
  ): Promise<{ items: CommentItem[]; meta: CursorMeta }> {
    const post = await prisma.post.findFirst({
      where: { AND: [{ slug }, visibilityWhere(viewer)] },
      select: { id: true },
    })
    if (!post) throw notFound('文章不存在或未公开')

    const where = {
      postId: post.id,
      deletedAt: null,
      parentId: null,
      ...(input.cursor ? { id: { lt: input.cursor } } : {}),
    }

    const [total, roots] = await Promise.all([
      prisma.comment.count({ where: { postId: post.id, deletedAt: null, parentId: null } }),
      prisma.comment.findMany({
        where,
        include: {
          author: { select: { id: true, username: true, nickname: true } },
          replies: {
            where: { deletedAt: null },
            include: { author: { select: { id: true, username: true, nickname: true } } },
            orderBy: { createdAt: 'asc' },
            take: 50,
          },
        },
        orderBy: { createdAt: 'desc' },
        take: input.limit + 1,
      }),
    ])

    const hasMore = roots.length > input.limit
    const page = hasMore ? roots.slice(0, input.limit) : roots

    return {
      items: page.map(toCommentItem),
      meta: {
        nextCursor: page.length > 0 ? page[page.length - 1].id : null,
        hasMore,
        total,
      },
    }
  },

  async create(
    slug: string,
    input: { content: string; parentId?: number | null },
    author: PublicUser,
  ): Promise<CommentItem> {
    const post = await prisma.post.findFirst({
      where: { AND: [{ slug }, visibilityWhere(author)] },
      select: { id: true },
    })
    if (!post) throw notFound('文章不存在或未公开')

    if (input.parentId) {
      const parent = await prisma.comment.findFirst({
        where: { id: input.parentId, postId: post.id, deletedAt: null },
        select: { id: true, parentId: true },
      })
      if (!parent) throw notFound('要回复的评论不存在')
      // 只支持两级：回复「回复」时挂到同一个顶层评论下
      if (parent.parentId) {
        input = { ...input, parentId: parent.parentId }
      }
    }

    const comment = await prisma.comment.create({
      data: {
        content: input.content,
        postId: post.id,
        authorId: author.id,
        parentId: input.parentId ?? null,
      },
      include: { author: { select: { id: true, username: true, nickname: true } } },
    })

    return toCommentItem({ ...comment, replies: [] })
  },

  async remove(id: number, viewer: PublicUser): Promise<void> {
    const comment = await prisma.comment.findFirst({ where: { id, deletedAt: null } })
    if (!comment) throw notFound('评论不存在')

    const post = await prisma.post.findUnique({
      where: { id: comment.postId },
      select: { authorId: true },
    })

    const isOwner = comment.authorId === viewer.id
    const isPostAuthor = post?.authorId === viewer.id
    const isAdmin = viewer.role === 'ADMIN'
    if (!isOwner && !isPostAuthor && !isAdmin) {
      throw forbidden('只能删除自己的评论')
    }

    // 软删除顶层评论时，其下回复一并隐藏，避免出现孤立的「回复了不存在的评论」
    await prisma.$transaction(async (tx) => {
      await tx.comment.update({ where: { id: comment.id }, data: { deletedAt: new Date() } })
      await tx.comment.updateMany({
        where: { parentId: comment.id, deletedAt: null },
        data: { deletedAt: new Date() },
      })
    })
  },

  async countByPostId(postId: number): Promise<number> {
    return prisma.comment.count({ where: { postId, deletedAt: null } })
  },
}
