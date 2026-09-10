/** 响应序列化：Prisma 记录 -> 对外 DTO（统一 Date -> ISO 字符串，剔除敏感字段） */

import type { Comment, Post, Tag, User } from '@prisma/client'
import type { CommentItem, PostSummary, PostDetail, TagSummary } from './types'

type PostWithRelations = Post & {
  author: Pick<User, 'id' | 'username' | 'nickname'>
  tags?: { tag: Tag }[]
  _count?: { comments: number }
}

export function toPostSummary(post: PostWithRelations): PostSummary {
  return {
    id: post.id,
    slug: post.slug,
    title: post.title,
    summary: post.summary,
    status: post.status,
    views: post.views,
    publishedAt: post.publishedAt ? post.publishedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
    updatedAt: post.updatedAt.toISOString(),
    author: {
      id: post.author.id,
      username: post.author.username,
      nickname: post.author.nickname,
    },
    tags: (post.tags ?? []).map(({ tag }) => ({
      id: tag.id,
      name: tag.name,
      slug: tag.slug,
    })),
    ...(post._count ? { commentCount: post._count.comments } : {}),
  }
}

export function toPostDetail(post: PostWithRelations & { html: string }): PostDetail {
  return { ...toPostSummary(post), content: post.content, html: post.html }
}

export function toTagSummary(tag: Tag & { _count?: { posts: number } }): TagSummary {
  return {
    id: tag.id,
    name: tag.name,
    slug: tag.slug,
    ...(tag._count ? { postCount: tag._count.posts } : {}),
  }
}

type CommentWithAuthor = Comment & {
  author: Pick<User, 'id' | 'username' | 'nickname'>
  replies?: CommentWithAuthor[]
}

export function toCommentItem(comment: CommentWithAuthor): CommentItem {
  return {
    id: comment.id,
    content: comment.content,
    parentId: comment.parentId,
    createdAt: comment.createdAt.toISOString(),
    author: {
      id: comment.author.id,
      username: comment.author.username,
      nickname: comment.author.nickname,
    },
    replies: (comment.replies ?? []).map(toCommentItem),
  }
}
