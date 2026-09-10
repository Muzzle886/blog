import type { MetadataRoute } from 'next'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/**
 * 动态站点地图。
 * 替代原来的静态 public/sitemap.xml —— 静态文件里的 URL 与日期需要手工维护，
 * 内容一变就过期，而且无法覆盖文章详情页。
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [posts, tags] = await Promise.all([
    prisma.post.findMany({
      where: { deletedAt: null, status: 'PUBLISHED' },
      select: { slug: true, updatedAt: true },
      orderBy: { publishedAt: 'desc' },
      take: 5000,
    }),
    prisma.tag.findMany({ select: { slug: true } }),
  ])

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${BASE_URL}/`, changeFrequency: 'daily', priority: 1 },
    { url: `${BASE_URL}/writing`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${BASE_URL}/topics`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${BASE_URL}/timeline`, changeFrequency: 'weekly', priority: 0.7 },
    { url: `${BASE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  return [
    ...staticRoutes,
    ...posts.map((post) => ({
      url: `${BASE_URL}/posts/${post.slug}`,
      lastModified: post.updatedAt,
      changeFrequency: 'weekly' as const,
      priority: 0.9,
    })),
    ...tags.map((tag) => ({
      url: `${BASE_URL}/topics/${encodeURIComponent(tag.slug)}`,
      changeFrequency: 'weekly' as const,
      priority: 0.6,
    })),
  ]
}
