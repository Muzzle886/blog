import { ErrorCode, type ErrorCodeValue } from './types'

/**
 * 业务异常。服务层抛出，由 API 层（lib/http.ts）统一转换为 HTTP 响应。
 */
export class AppError extends Error {
  readonly status: number
  readonly code: ErrorCodeValue
  readonly details?: { path: string; message: string }[]

  constructor(
    status: number,
    code: ErrorCodeValue,
    message: string,
    details?: { path: string; message: string }[],
  ) {
    super(message)
    this.name = 'AppError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const badRequest = (message = '请求参数不合法') =>
  new AppError(400, ErrorCode.BAD_REQUEST, message)

export const validationFailed = (
  details: { path: string; message: string }[],
  message = '参数校验失败',
) => new AppError(422, ErrorCode.VALIDATION_FAILED, message, details)

export const unauthorized = (message = '请先登录') =>
  new AppError(401, ErrorCode.UNAUTHORIZED, message)

export const forbidden = (message = '没有操作权限') =>
  new AppError(403, ErrorCode.FORBIDDEN, message)

export const notFound = (message = '资源不存在') =>
  new AppError(404, ErrorCode.NOT_FOUND, message)

export const conflict = (message = '资源已存在') =>
  new AppError(409, ErrorCode.CONFLICT, message)

export const tooManyRequests = (message = '操作过于频繁，请稍后再试') =>
  new AppError(429, ErrorCode.TOO_MANY_REQUESTS, message)
