import 'server-only'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { forbidden, notFound } from '@/lib/errors'
import { generateSlug } from '@/lib/crypto'
import { extractSummary, renderMarkdown } from '@/lib/markdown'
import { toPostDetail, toPostSummary } from '@/lib/serializers'
import type { PaginationMeta, PostDetail, PostStatus, PostSummary, PublicUser } from '@/lib/types'
import { tagService } from './tag-service'

export interface ListPostsInput {
  page: number
  pageSize: number
  q?: string
  tag?: string
  author?: string
  status: 'PUBLISHED' | 'DRAFT' | 'ALL'
  sort: 'latest' | 'oldest' | 'popular'
}

export interface CreatePostInput {
  title: string
  summary?: string
  content: string
  status: PostStatus
  tags: string[]
}

export type UpdatePostInput = Partial<CreatePostInput>

const authorSelect = { id: true, username: true, nickname: true } as const

/**
 * 可见性规则（贯穿所有读接口）：
 *  - 游客/普通访客：只能看到 PUBLISHED 且未软删除的文章
 *  - 作者本人：可见自己的全部文章（含草稿）
 *  - 管理员：可见全部
 */
function visibilityWhere(viewer?: PublicUser | null): Prisma.PostWhereInput {
  if (viewer?.role === 'ADMIN') return { deletedAt: null }
  if (viewer) {
    return {
      deletedAt: null,
      OR: [{ status: 'PUBLISHED' }, { authorId: viewer.id }],
    }
  }
  return { deletedAt: null, status: 'PUBLISHED' }
}

function buildOrderBy(sort: ListPostsInput['sort']): Prisma.PostOrderByWithRelationInput[] {
  switch (sort) {
    case 'oldest':
      return [{ publishedAt: 'asc' }, { id: 'asc' }]
    case 'popular':
      return [{ views: 'desc' }, { publishedAt: 'desc' }]
    default:
      return [{ publishedAt: 'desc' }, { id: 'desc' }]
  }
}

export const postService = {
  async list(
    input: ListPostsInput,
    viewer?: PublicUser | null,
  ): Promise<{ items: PostSummary[]; meta: PaginationMeta }> {
    const filters: Prisma.PostWhereInput[] = [visibilityWhere(viewer)]

    if (input.status !== 'ALL') {
      // 草稿只有作者本人/管理员可查，且必须显式指定
      if (input.status === 'DRAFT' && !viewer) {
        throw forbidden('查看草稿需要登录')
      }
      filters.push({ status: input.status })
    }
    if (input.tag) {
      filters.push({ tags: { some: { tag: { slug: input.tag } } } })
    }
    if (input.author) {
      filters.push({
        author: { OR: [{ username: input.author }, { nickname: input.author }] },
      })
    }
    if (input.q) {
      const q = input.q
      filters.push({
        OR: [{ title: { contains: q } }, { summary: { contains: q } }, { content: { contains: q } }],
      })
    }

    const where: Prisma.PostWhereInput = { AND: filters }
    const skip = (input.page - 1) * input.pageSize

    const [total, posts] = await Promise.all([
      prisma.post.count({ where }),
      prisma.post.findMany({
        where,
        include: {
          author: { select: authorSelect },
          tags: { include: { tag: true } },
          _count: { select: { comments: { where: { deletedAt: null } } } },
        },
        orderBy: buildOrderBy(input.sort),
        skip,
        take: input.pageSize,
      }),
    ])

    return {
      items: posts.map((post) =>
        toPostSummary({
          ...post,
          _count: { comments: post._count.comments },
        }),
      ),
      meta: {
        page: input.page,
        pageSize: input.pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / input.pageSize)),
      },
    }
  },

  async getBySlug(
    slug: string,
    viewer?: PublicUser | null,
    options: { incrementViews?: boolean } = {},
  ): Promise<PostDetail> {
    const post = await prisma.post.findFirst({
      where: { AND: [{ slug }, visibilityWhere(viewer)] },
      include: {
        author: { select: authorSelect },
        tags: { include: { tag: true } },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    })
    if (!post) throw notFound('文章不存在或未公开')

    if (options.incrementViews && post.status === 'PUBLISHED') {
      // 阅读量统计失败不应阻塞正文展示
      prisma.post
        .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
        .catch((error) => console.warn('[post] increment views failed:', error))
    }

    return toPostDetail({
      ...post,
      html: renderMarkdown(post.content),
    })
  },

  /** 编辑态读取：仅作者本人或管理员，可读草稿 */
  async getForEdit(slug: string, viewer: PublicUser): Promise<PostDetail> {
    const post = await prisma.post.findFirst({
      where: { slug, deletedAt: null },
      include: {
        author: { select: authorSelect },
        tags: { include: { tag: true } },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    })
    if (!post) throw notFound('文章不存在')
    if (post.authorId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden('只能编辑自己的文章')
    }
    return toPostDetail({ ...post, html: renderMarkdown(post.content) })
  },

  async create(input: CreatePostInput, author: PublicUser): Promise<PostDetail> {
    const summary = input.summary?.trim() || extractSummary(input.content)
    const publishedAt = input.status === 'PUBLISHED' ? new Date() : null

    const postId = await prisma.$transaction(async (tx) => {
      const post = await tx.post.create({
        data: {
          slug: generateSlug(),
          title: input.title,
          summary,
          content: input.content,
          status: input.status,
          publishedAt,
          authorId: author.id,
        },
      })
      await tagService.syncPostTags(post.id, input.tags, tx)
      return post.id
    })

    return postService.getBySlugById(postId, author)
  },

  async update(slug: string, input: UpdatePostInput, viewer: PublicUser): Promise<PostDetail> {
    const existing = await prisma.post.findFirst({ where: { slug, deletedAt: null } })
    if (!existing) throw notFound('文章不存在')
    if (existing.authorId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden('只能编辑自己的文章')
    }

    const data: Prisma.PostUpdateInput = {}
    if (input.title !== undefined) data.title = input.title
    if (input.content !== undefined) data.content = input.content

    // 摘要的三条规则：
    //   1. 显式传入 -> 用传入值，空串则回退为自动截取
    //   2. 未传入但正文变了 -> 重新截取，否则摘要会停留在旧正文上
    //   3. 未传入且正文没变 -> 保持原值不动
    if (input.summary !== undefined) {
      data.summary = input.summary.trim() || extractSummary(input.content ?? existing.content)
    } else if (input.content !== undefined) {
      data.summary = input.summary ?? extractSummary(input.content)
    }

    if (input.status !== undefined && input.status !== existing.status) {
      data.status = input.status
      // 首次发布时落 publishedAt；从已发布改回草稿时保留原发布时间
      if (input.status === 'PUBLISHED' && !existing.publishedAt) {
        data.publishedAt = new Date()
      }
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.post.update({ where: { id: existing.id }, data })
      }
      if (input.tags !== undefined) {
        await tagService.syncPostTags(existing.id, input.tags, tx)
      }
    })

    return postService.getBySlugById(existing.id, viewer)
  },

  /** 软删除：同时清理孤儿标签 */
  async remove(slug: string, viewer: PublicUser): Promise<void> {
    const existing = await prisma.post.findFirst({ where: { slug, deletedAt: null } })
    if (!existing) throw notFound('文章不存在')
    if (existing.authorId !== viewer.id && viewer.role !== 'ADMIN') {
      throw forbidden('只能删除自己的文章')
    }
    await prisma.$transaction(async (tx) => {
      await tx.post.update({ where: { id: existing.id }, data: { deletedAt: new Date() } })
      await tagService.pruneOrphans(tx)
    })
  },

  async getBySlugById(id: number, viewer: PublicUser): Promise<PostDetail> {
    const post = await prisma.post.findFirst({
      where: { id, deletedAt: null },
      include: {
        author: { select: authorSelect },
        tags: { include: { tag: true } },
        _count: { select: { comments: { where: { deletedAt: null } } } },
      },
    })
    if (!post) throw notFound('文章不存在')
    return toPostDetail({
      ...post,
      html: renderMarkdown(post.content),
    })
  },

  /** 归档：按年月分组统计已发布文章，用于归档页 */
  async archive(): Promise<{ year: number; month: number; count: number; posts: PostSummary[] }[]> {
    const posts = await prisma.post.findMany({
      where: { deletedAt: null, status: 'PUBLISHED', publishedAt: { not: null } },
      include: {
        author: { select: authorSelect },
        tags: { include: { tag: true } },
      },
      orderBy: [{ publishedAt: 'desc' }, { id: 'desc' }],
    })

    const groups = new Map<string, { year: number; month: number; count: number; posts: PostSummary[] }>()
    for (const post of posts) {
      const date = post.publishedAt as Date
      const key = `${date.getFullYear()}-${date.getMonth() + 1}`
      const group = groups.get(key) ?? {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        count: 0,
        posts: [],
      }
      group.posts.push(toPostSummary(post))
      group.count += 1
      groups.set(key, group)
    }
    return Array.from(groups.values())
  },

  async stats(): Promise<{ posts: number; drafts: number; tags: number; comments: number }> {
    const [posts, drafts, tags, comments] = await Promise.all([
      prisma.post.count({ where: { deletedAt: null, status: 'PUBLISHED' } }),
      prisma.post.count({ where: { deletedAt: null, status: 'DRAFT' } }),
      prisma.tag.count(),
      prisma.comment.count({ where: { deletedAt: null } }),
    ])
    return { posts, drafts, tags, comments }
  },
}

export { visibilityWhere, authorSelect }
