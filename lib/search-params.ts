/**
 * 页面 searchParams 归一化。
 *
 * Next.js 对重复出现的 query 参数会传数组（`?q=a&q=b` -> `['a','b']`），
 * 而页面里通常按 `string` 使用它，于是 `.trim()` 之类的调用会抛
 * TypeError 变成 500。API 路由有 searchParamsToObject + zod 兜住，
 * 服务端渲染的页面没有，所以统一在这里收口。
 *
 * 同时把分页参数夹到合法范围：`Number('1e999')` 是 Infinity，
 * 而 `Infinity || 1` 仍是 Infinity，直接进 Prisma 的 skip 会很危险。
 */

export type PageSearchParams = Record<string, string | string[] | undefined>

/** 取单值：数组取第一个（与 API 层 searchParamsToObject 的行为一致） */
export function first(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

/** 取字符串，缺失或空串时回退 */
export function str(value: string | string[] | undefined, fallback = ''): string {
  const raw = first(value)
  const trimmed = (raw ?? '').trim()
  return trimmed || fallback
}

/** 取可选字符串（空则返回 undefined，便于直接传给服务层） */
export function optionalStr(value: string | string[] | undefined): string | undefined {
  const raw = first(value)?.trim()
  return raw || undefined
}

/** 取分页页码：必须是 1..max 的整数，其余一律回退为 1 */
export function page(value: string | string[] | undefined, max = 10_000): number {
  const raw = first(value)
  if (!raw) return 1
  const parsed = Number(raw)
  if (!Number.isFinite(parsed)) return 1
  const integer = Math.trunc(parsed)
  if (integer < 1) return 1
  return Math.min(integer, max)
}
