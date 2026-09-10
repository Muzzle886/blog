import { z } from 'zod'
import { badRequest, validationFailed } from './errors'

/** 校验并返回数据；失败时抛出 422 AppError（含字段级明细） */
export function parseOrThrow<T extends z.ZodTypeAny>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input)
  if (!result.success) {
    throw validationFailed(
      result.error.issues.map((issue) => ({
        path: issue.path.join('.') || '_',
        message: issue.message,
      })),
    )
  }
  return result.data
}

/** 异步校验请求体 JSON，body 非法 JSON 时抛 400 */
export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw validationFailed([{ path: '_', message: '请求体必须是合法 JSON' }], '请求体解析失败')
  }
}

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(10),
})

export const idParamSchema = z.object({
  id: z.coerce.number().int().positive({ message: 'id 必须是正整数' }),
})

export const slugParamSchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(80)
    .regex(/^[a-zA-Z0-9_-]+$/, 'slug 只能包含字母、数字、下划线和连字符'),
})

export const usernameSchema = z
  .string()
  .trim()
  .min(3, '用户名至少 3 个字符')
  .max(32, '用户名最多 32 个字符')
  .regex(/^[a-zA-Z0-9_-]+$/, '用户名只能包含字母、数字、下划线和连字符')

export const passwordSchema = z
  .string()
  .min(8, '密码至少 8 位')
  .max(64, '密码最多 64 位')
  .regex(/[a-zA-Z]/, '密码需包含字母')
  .regex(/[0-9]/, '密码需包含数字')

/**
 * 口令字段一律以密文信封提交（RSA-OAEP），服务端解密后再校验强度。
 * 这里只做「外壳形状」校验；真正的长度/复杂度在解密后由 assertPassword 检查，
 * 因此明文永远不会出现在请求体里。
 */
export const encryptedPasswordSchema = z
  .string()
  .min(1, '请输入密码')
  .max(2048, '密文过长')
  .refine((value) => value.startsWith('rsa-oaep-sha256:'), {
    message: '密码必须以加密形式提交',
  })

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('邮箱格式不正确').max(128),
  password: encryptedPasswordSchema,
  nickname: z.string().trim().min(1, '昵称不能为空').max(32, '昵称最多 32 个字符'),
})

export const loginSchema = z.object({
  /** 支持用户名或邮箱登录 */
  identifier: z.string().trim().min(1, '请输入用户名或邮箱').max(128, '输入过长'),
  password: encryptedPasswordSchema,
})

export const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(32).optional(),
  bio: z.string().trim().max(200, '简介最多 200 字').nullish(),
  email: z.string().trim().email('邮箱格式不正确').max(128).optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: encryptedPasswordSchema,
  newPassword: encryptedPasswordSchema,
})

const tagNameSchema = z.string().trim().min(1).max(32)

export const postCreateSchema = z.object({
  title: z.string().trim().min(1, '标题不能为空').max(120, '标题最多 120 字'),
  summary: z.string().trim().max(300, '摘要最多 300 字').optional(),
  content: z.string().min(1, '正文不能为空'),
  status: z.enum(['DRAFT', 'PUBLISHED']).default('DRAFT'),
  tags: z.array(tagNameSchema).max(8, '最多 8 个标签').default([]),
})

export const postUpdateSchema = postCreateSchema.partial().refine(
  (value) => Object.keys(value).length > 0,
  { message: '至少需要提供一个待更新字段' },
)

export const postQuerySchema = paginationSchema.extend({
  q: z.string().trim().max(64).optional(),
  tag: z.string().trim().max(48).optional(),
  author: z.string().trim().max(32).optional(),
  status: z.enum(['DRAFT', 'PUBLISHED', 'ALL']).default('PUBLISHED'),
  sort: z.enum(['latest', 'oldest', 'popular']).default('latest'),
})

export const commentCreateSchema = z.object({
  content: z.string().trim().min(1, '评论不能为空').max(1000, '评论最多 1000 字'),
  parentId: z.coerce.number().int().positive().nullish(),
})

export const commentQuerySchema = z.object({
  cursor: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
})

/* ==================== 口令解密与强度校验 ==================== */

/*
 * 说明：解密放在这里而不是 zod 里，是因为它是异步的（crypto），
 * 而 zod 的 refine 同步执行。解密后立刻用 passwordSchema 校验强度，
 * 这样「最短 8 位、需含字母与数字」等规则仍然生效，且错误提示与从前一致。
 */

import { decryptPassword } from './password-crypto'

export interface DecryptedPasswords {
  [field: string]: string
}

/**
 * 解密一个口令字段。失败时抛出 400，提示不区分具体原因
 * （避免把「密钥不匹配」「密文损坏」暴露成可探测的差异）。
 */
export function decryptField(value: string, field: string): string {
  const result = decryptPassword(value)
  if (!result.ok) {
    const message =
      result.reason === 'unknown_key'
        ? '加密密钥已更新，请刷新页面后重试'
        : '密码解密失败，请刷新页面后重试'
    throw badRequest(`${field}: ${message}`)
  }
  return result.plaintext
}

/** 解密并按强度规则校验一个新口令（登录时只解密不校验强度） */
export function decryptAndValidateNewPassword(value: string, field: string): string {
  const plaintext = decryptField(value, field)
  const parsed = passwordSchema.safeParse(plaintext)
  if (!parsed.success) {
    throw validationFailed(
      parsed.error.issues.map((issue) => ({ path: field, message: issue.message })),
    )
  }
  return plaintext
}
