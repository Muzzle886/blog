/**
 * 领域类型与错误码定义。
 * 前端组件与 API 层共享这些类型，保证响应结构一致。
 */

export type Role = 'USER' | 'ADMIN'
export type PostStatus = 'DRAFT' | 'PUBLISHED'

/** 业务错误码：与 HTTP 状态码解耦，便于前端做精确分支 */
export const ErrorCode = {
  BAD_REQUEST: 'BAD_REQUEST',
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode]

export interface ApiErrorBody {
  error: {
    code: ErrorCodeValue
    message: string
    /** 字段级校验明细，仅在 VALIDATION_FAILED 时出现 */
    details?: { path: string; message: string }[]
  }
}

export interface ApiSuccessBody<T> {
  data: T
  meta?: Record<string, unknown>
}

export interface PaginationMeta {
  page: number
  pageSize: number
  total: number
  totalPages: number
}

export interface CursorMeta {
  nextCursor: number | null
  hasMore: boolean
  total: number
}

/** 对外暴露的公开用户信息（绝不包含 passwordHash） */
export interface PublicUser {
  id: number
  username: string
  nickname: string
  email?: string
  bio: string | null
  role: Role
  createdAt: string
}

export interface TagSummary {
  id: number
  name: string
  slug: string
  postCount?: number
}

export interface PostSummary {
  id: number
  slug: string
  title: string
  summary: string
  status: PostStatus
  views: number
  publishedAt: string | null
  createdAt: string
  updatedAt: string
  author: Pick<PublicUser, 'id' | 'username' | 'nickname'>
  tags: TagSummary[]
  commentCount?: number
}

export interface PostDetail extends PostSummary {
  content: string
  /** 服务端渲染好的安全 HTML，前端直接注入 */
  html: string
}

export interface CommentItem {
  id: number
  content: string
  parentId: number | null
  createdAt: string
  author: Pick<PublicUser, 'id' | 'username' | 'nickname'>
  replies: CommentItem[]
}
