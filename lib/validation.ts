import { z } from 'zod'
import { validationFailed } from './errors'

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

export const registerSchema = z.object({
  username: usernameSchema,
  email: z.string().trim().email('邮箱格式不正确').max(128),
  password: passwordSchema,
  nickname: z.string().trim().min(1, '昵称不能为空').max(32, '昵称最多 32 个字符'),
})

export const loginSchema = z.object({
  /** 支持用户名或邮箱登录 */
  identifier: z.string().trim().min(1, '请输入用户名或邮箱').max(128, '输入过长'),
  /**
   * 上限必须有：scrypt 的计算成本随输入长度增长，登录接口若不限制
   * 输入长度，就成了廉价的 CPU/内存放大器。
   */
  password: z.string().min(1, '请输入密码').max(128, '密码最多 128 位'),
})

export const updateProfileSchema = z.object({
  nickname: z.string().trim().min(1).max(32).optional(),
  bio: z.string().trim().max(200, '简介最多 200 字').nullish(),
  email: z.string().trim().email('邮箱格式不正确').max(128).optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, '请输入当前密码').max(128, '密码最多 128 位'),
  newPassword: passwordSchema,
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
