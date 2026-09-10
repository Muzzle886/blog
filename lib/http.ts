import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { AppError } from './errors'

export { readJson } from './validation'
import { ErrorCode, type ApiErrorBody, type ApiSuccessBody } from './types'

/**
 * API 响应约定
 *  成功：{ data, meta? }            状态码 200 / 201 / 204
 *  失败：{ error: { code, message, details? } }
 *       code 为业务错误码（见 lib/types.ts），与 HTTP 状态码解耦
 */

export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200): NextResponse {
  const body: ApiSuccessBody<T> = meta ? { data, meta } : { data }
  return NextResponse.json(body, { status })
}

export function created<T>(data: T, meta?: Record<string, unknown>): NextResponse {
  return ok(data, meta, 201)
}

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204 })
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
 * 路由包装器：统一异常处理，避免每个 handler 都写 try/catch。
 *
 *   export const GET = route(async (req) => ok(await listPosts(...)))
 */
export function route<Args extends unknown[]>(
  handler: (request: Request, ...args: Args) => Promise<NextResponse>,
): (request: Request, ...args: Args) => Promise<NextResponse> {
  return async (request, ...args) => {
    try {
      return await handler(request, ...args)
    } catch (error) {
      return toErrorResponse(error)
    }
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
