import type { ApiErrorBody } from './types'

/**
 * 前端 API 客户端。
 * 统一处理：JSON 编解码、错误码提取、Credentials 携带。
 * 所有方法与后端 REST 路由一一对应，见 README「API 一览」。
 */

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: { path: string; message: string }[]

  constructor(status: number, code: string, message: string, details?: { path: string; message: string }[]) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  signal?: AbortSignal
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload = text ? (JSON.parse(text) as unknown) : null

  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error
    throw new ApiError(
      response.status,
      error?.code ?? 'INTERNAL_ERROR',
      error?.message ?? `请求失败（${response.status}）`,
      error?.details,
    )
  }

  return ((payload as { data: T } | null)?.data ?? null) as T
}

function toQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const query = search.toString()
  return query ? `?${query}` : ''
}

export interface Envelope<T> {
  data: T
  meta?: Record<string, unknown>
}

/** 需要同时读取 data 与 meta（分页信息）时使用 */
export async function requestWithMeta<T>(
  path: string,
  options: RequestOptions = {},
): Promise<Envelope<T>> {
  const { method = 'GET', body, signal } = options
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
    cache: 'no-store',
  })
  const text = await response.text()
  const payload = text ? JSON.parse(text) : null
  if (!response.ok) {
    const error = (payload as ApiErrorBody | null)?.error
    throw new ApiError(response.status, error?.code ?? 'INTERNAL_ERROR', error?.message ?? '请求失败')
  }
  return payload as Envelope<T>
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { signal }),
  getWithMeta: <T>(path: string, signal?: AbortSignal) => requestWithMeta<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
  toQuery,
}
