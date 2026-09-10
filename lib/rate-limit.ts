import 'server-only'
import { tooManyRequests } from './errors'

/**
 * 进程内滑动窗口限流。
 *
 * 设计取舍：
 *  - 目标是低依赖。Redis 在 .env 里保留但本项目未启用，引入它会多一个
 *    必须可用的外部依赖。单实例部署下进程内计数已经足够挡住撞库。
 *  - 局限必须说清楚：多实例部署时每个实例各算一份，实际额度是
 *    「单实例额度 × 实例数」。届时应换成 Redis 或网关层限流。
 *  - 计数只存内存，进程重启即清零，这是可接受的（攻击者无法触发重启）。
 */

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

/** 防止 Map 无限增长：条目数超过上限时清掉已过期的桶 */
const MAX_BUCKETS = 10_000

function sweep(now: number): void {
  // 用 forEach 而非 for...of：tsconfig 未设置 target，Map 迭代需要
  // downlevelIteration 或 es2015+ 目标
  buckets.forEach((bucket, key) => {
    if (bucket.resetAt <= now) buckets.delete(key)
  })
}

export interface RateLimitRule {
  /** 窗口长度（毫秒） */
  windowMs: number
  /** 窗口内允许的最大次数 */
  max: number
}

export const RateLimit = {
  /** 登录：按账号+来源，防定向撞库 */
  login: { windowMs: 15 * 60 * 1000, max: 10 },
  /** 登录：按来源 IP，防广撒网式撞库 */
  loginByIp: { windowMs: 15 * 60 * 1000, max: 30 },
  /** 注册：按来源 IP，防批量注册 */
  register: { windowMs: 60 * 60 * 1000, max: 10 },
  /** 评论：按用户 */
  comment: { windowMs: 60 * 1000, max: 5 },
  /** 发表文章：按用户 */
  post: { windowMs: 60 * 1000, max: 10 },
} as const satisfies Record<string, RateLimitRule>

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  /** 距离窗口重置的秒数 */
  retryAfterSeconds: number
}

/**
 * 记一次操作并判断是否超限。
 * @param key 维度标识，例如 `login:ip:1.2.3.4`
 */
export function consume(key: string, rule: RateLimitRule): RateLimitResult {
  const now = Date.now()

  if (buckets.size > MAX_BUCKETS) sweep(now)

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rule.windowMs })
    return {
      allowed: true,
      remaining: rule.max - 1,
      retryAfterSeconds: Math.ceil(rule.windowMs / 1000),
    }
  }

  bucket.count += 1
  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))

  if (bucket.count > rule.max) {
    return { allowed: false, remaining: 0, retryAfterSeconds }
  }
  return { allowed: true, remaining: rule.max - bucket.count, retryAfterSeconds }
}

/**
 * 超限则抛 429（由 lib/http.ts 统一转换）。
 * 注意：提示语刻意与「账号或密码错误」区分开，但仍不透露账号是否存在。
 */
export function enforce(key: string, rule: RateLimitRule): void {
  const result = consume(key, rule)
  if (!result.allowed) {
    throw tooManyRequests(`操作过于频繁，请 ${result.retryAfterSeconds} 秒后重试`)
  }
}

/** 从请求头提取来源 IP。生产环境应确保只信任自己的反向代理。 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip')?.trim() || 'unknown'
}
