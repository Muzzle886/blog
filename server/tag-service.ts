import 'server-only'
import { normalizeTags, slugifyTag } from '@/lib/slug'
import { conflict, notFound } from '@/lib/errors'
import { toTagSummary } from '@/lib/serializers'
import { db, type Db } from './db'
import type { TagSummary } from '@/lib/types'

/**
 * 标签服务。
 * 标签是「文章的子资源」，没有独立的创建接口 —— 只在文章写入时按名称 upsert，
 * 这样避免了「先建标签再建文章」的两步式前端交互。
 */
export const tagService = {
  /** 列出所有标签及其已发布文章数 */
  async list(client?: Db): Promise<TagSummary[]> {
    const tags = await db(client).tag.findMany({
      include: {
        _count: {
          select: {
            posts: { where: { post: { status: 'PUBLISHED', deletedAt: null } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    })
    return tags
      .map((tag) => toTagSummary({ ...tag, _count: { posts: tag._count.posts } }))
      .filter((tag) => (tag.postCount ?? 0) > 0)
      .sort((a, b) => (b.postCount ?? 0) - (a.postCount ?? 0) || a.name.localeCompare(b.name))
  },

  async getBySlug(slug: string, client?: Db): Promise<TagSummary> {
    const tag = await db(client).tag.findUnique({ where: { slug } })
    if (!tag) throw notFound('标签不存在')
    return toTagSummary(tag)
  },

  /** 按名称批量 upsert，返回标签 id 列表（保持输入顺序） */
  async resolveOrCreate(names: string[], client?: Db): Promise<number[]> {
    const clean = normalizeTags(names)
    if (clean.length === 0) return []
    const client0 = db(client)

    const ids: number[] = []
    for (const name of clean) {
      const slug = slugifyTag(name)
      try {
        const tag = await client0.tag.upsert({
          where: { name },
          update: {},
          create: { name, slug },
        })
        ids.push(tag.id)
      } catch {
        // 并发下 name 与 slug 可能分别撞车，回退为按任一唯一键查找
        const existing = await client0.tag.findFirst({ where: { OR: [{ name }, { slug }] } })
        if (!existing) throw conflict(`标签「${name}」创建失败，请重试`)
        ids.push(existing.id)
      }
    }
    return Array.from(new Set(ids))
  },

  /** 替换某篇文章的标签集合 */
  async syncPostTags(postId: number, names: string[], client?: Db): Promise<void> {
    const client0 = db(client)
    const tagIds = await tagService.resolveOrCreate(names, client0)
    await client0.postTag.deleteMany({ where: { postId } })
    if (tagIds.length > 0) {
      await client0.postTag.createMany({
        data: tagIds.map((tagId) => ({ postId, tagId })),
        skipDuplicates: true,
      })
    }
  },

  /** 清理没有任何文章引用的标签 */
  async pruneOrphans(client?: Db): Promise<number> {
    const result = await db(client).tag.deleteMany({ where: { posts: { none: {} } } })
    return result.count
  },
}
