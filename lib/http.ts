import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from './errors'

export { readJson } from './validation'
import { ErrorCode, type ApiErrorBody, type ApiSuccessBody } from './types'

/**
 * API 响应约定
 *  成功：{ data, meta? }            状态码 200（创建为 201）
 *  失败：{ error: { code, message, details? } }
 *       code 为业务错误码（见 lib/types.ts），与 HTTP 状态码解耦
 *
 * 约定：**成功的写操作也返回响应体**。原先删除类接口返回 204 空响应，
 * 调用方只能靠状态码猜结果；统一改成 200 + 明确的确认字段。
 */

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200): NextResponse {
  const body: ApiSuccessBody<T> = meta ? { data, meta } : { data }
  return NextResponse.json(body, { status })
}

export function created<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return ok(data, meta, 201)
}

export function fail(
  status: number,
  code: ApiErrorBody['error']['code'],
  message: string,
  details?: { path: string; message: string }[],
): NextResponse {
  const body: ApiErrorBody = { error: { code, message, ...(details ? { details } : {}) } }
  return NextResponse.json(body, { status })
}

/** 把任意异常收敛成统一错误响应；未预期异常记录日志并返回 500 */
export function toErrorResponse(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return fail(error.status, error.code, error.message, error.details)
  }
  if (error instanceof ZodError) {
    return fail(
      422,
      ErrorCode.VALIDATION_FAILED,
      '参数校验失败',
      error.issues.map((issue) => ({
        path: issue.path.join('.') || '_',
        message: issue.message,
      })),
    )
  }
  // Prisma 唯一约束等已知数据库错误
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code
    if (code === 'P2002') {
      return fail(409, ErrorCode.CONFLICT, '资源已存在')
    }
    if (code === 'P2025') {
      return fail(404, ErrorCode.NOT_FOUND, '资源不存在')
    }
  }
  console.error('[api] unhandled error:', error)
  return fail(500, ErrorCode.INTERNAL_ERROR, '服务器内部错误')
}

/**
 * 路由包装器：统一异常处理 + 统一缓存策略，避免每个 handler 都写 try/catch。
 *
 *   export const GET = route(async (req) => ok(await listPosts(...)))
 *
 * 关于缓存头：接口响应可能因 Cookie 不同而不同（例如 /api/users/me、
 * /api/posts 里作者能看到自己的草稿）。默认不下发任何 Cache-Control 时，
 * 共享缓存/CDN 可能按启发式规则缓存它，且 Vary 里没有 Cookie，
 * 于是把 A 的登录态响应发给 B。这里统一显式关闭缓存并声明 Vary。
 *
 * 实现上刻意「就地改写」而不是 new NextResponse(response.body, ...)：
 * 后者会丢掉 Set-Cookie —— 登录/注册正是在 Response 上挂会话 Cookie 的，
 * 重建响应会让「登录成功但没拿到 Cookie」，表现为后续请求全部 401。
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<NextResponse>,
): (request: Request, ...args: Args) => Promise<NextResponse> {
  return async (request, ...args) => {
    let response: NextResponse
    try {
      response = await handler(request, ...args)
    } catch (error) {
      response = toErrorResponse(error)
    }

    try {
      if (!response.headers.has('Cache-Control')) {
        response.headers.set('Cache-Control', 'no-store, must-revalidate')
      }
      // 声明响应会随 Cookie 变化，避免共享缓存串号
      if (!response.headers.has('Vary')) {
        response.headers.set('Vary', 'Cookie')
      }
    } catch {
      // 某些响应（如 redirect）的头部是只读的。缓存头是加固项，
      // 取不到就算了，绝不能因此把正常响应变成 500。
    }

    return response
  }
}

/** 解析 URL 查询参数为普通对象（供 zod 校验） */
export function searchParamsToObject(url: string): Record<string, string> {
  const { searchParams } = new URL(url)
  const result: Record<string, string> = {}
  searchParams.forEach((value, key) => {
    if (value !== '') result[key] = value
  })
  return result
}
