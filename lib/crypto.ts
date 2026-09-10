import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

const SALT_BYTES = 16
const KEY_LENGTH = 64

/**
 * scrypt 参数。
 *
 * OWASP Password Storage Cheat Sheet 对 scrypt 的建议是 N=2^17, r=8, p=1
 * （其次 N=2^16, r=8, p=2 等组合）。这里取 N=2^17, r=8, p=1：
 *   - 内存约 128 * N * r = 128 * 131072 * 8 ≈ 134 MB
 *   - 单次耗时约 200–400ms
 * 因此 maxmem 必须显式放大，否则 Node 会直接报错（默认上限 32MB）。
 *
 * 由于单次成本较高，登录接口必须配合限流（见 lib/rate-limit.ts），
 * 否则会变成廉价的 CPU/内存放大器。
 */
const CURRENT = { N: 1 << 17, r: 8, p: 1, maxmem: 256 * 1024 * 1024 } as const

/**
 * 历史上使用过的参数，用于兼容旧哈希。
 * 命中旧格式时由 verifyPassword 返回 needsRehash，调用方在登录成功后
 * 静默升级为当前参数 —— 用户无感知，不需要强制改密。
 */
const LEGACY = [
  { label: 'v1', N: 1 << 14, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
] as const

/**
 * 存储格式：
 *   scrypt$<N>$<r>$<p>$<saltHex>$<hashHex>   —— 当前格式，自描述参数
 *   scrypt$<saltHex>$<hashHex>               —— 旧格式（N 为 Node 默认 16384）
 */
export type HashParams = { N: number; r: number; p: number }

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(password, salt, KEY_LENGTH, {
    N: CURRENT.N,
    r: CURRENT.r,
    p: CURRENT.p,
    maxmem: CURRENT.maxmem,
  })
  return [
    'scrypt',
    CURRENT.N,
    CURRENT.r,
    CURRENT.p,
    salt.toString('hex'),
    derived.toString('hex'),
  ].join('$')
}

export interface VerifyResult {
  valid: boolean
  /** 哈希是否用了过时参数，需要升级 */
  needsRehash: boolean
}

/** 解析存储的哈希，返回参数、盐与期望值 */
function parse(stored: string): { params: HashParams; maxmem: number; salt: Buffer; expected: Buffer } | null {
  const parts = stored.split('$')
  if (parts[0] !== 'scrypt') return null

  if (parts.length === 6) {
    const [, nRaw, rRaw, pRaw, saltHex, hashHex] = parts
    const N = Number(nRaw)
    const r = Number(rRaw)
    const p = Number(pRaw)
    if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return null
    const legacyMatch = LEGACY.find((item) => item.N === N && item.r === r && item.p === p)
    return {
      params: { N, r, p },
      // 旧参数按当时的 maxmem 计算，否则会因上限不符而失败
      maxmem: legacyMatch ? legacyMatch.maxmem : CURRENT.maxmem,
      salt: Buffer.from(saltHex, 'hex'),
      expected: Buffer.from(hashHex, 'hex'),
    }
  }

  if (parts.length === 3) {
    // 旧格式：参数取当时的默认值
    const legacy = LEGACY[0]
    return {
      params: { N: legacy.N, r: legacy.r, p: legacy.p },
      maxmem: legacy.maxmem,
      salt: Buffer.from(parts[1], 'hex'),
      expected: Buffer.from(parts[2], 'hex'),
    }
  }

  return null
}

/**
 * 校验密码。
 * 始终使用 timingSafeEqual；注意两侧长度不等时它会抛异常，故先校验长度。
 */
export async function verifyPassword(password: string, stored: string): Promise<VerifyResult> {
  const parsed = parse(stored)
  if (!parsed) return { valid: false, needsRehash: false }
  if (parsed.expected.length !== KEY_LENGTH) return { valid: false, needsRehash: false }

  const derived = await scrypt(password, parsed.salt, KEY_LENGTH, {
    N: parsed.params.N,
    r: parsed.params.r,
    p: parsed.params.p,
    maxmem: parsed.maxmem,
  })

  const valid = timingSafeEqual(derived, parsed.expected)
  const needsRehash =
    valid &&
    (parsed.params.N !== CURRENT.N || parsed.params.r !== CURRENT.r || parsed.params.p !== CURRENT.p)

  return { valid, needsRehash }
}

/* ============================ 会话令牌 ============================ */

/**
 * 生成会话令牌：256 位 CSPRNG 随机数。
 * 这是唯一发送给浏览器的凭证，服务端只保存它的摘要。
 */
export function generateSessionToken(): string {
  return randomBytes(32).toString('hex')
}

/**
 * 会话令牌摘要（入库值）。
 *
 * 为什么不用 scrypt 这类慢哈希：
 *  - 令牌本身是 256 位均匀随机数，不存在弱口令可爆破，慢哈希只增加
 *    每请求开销，不增加安全性
 *  - 会话查找必须能走索引；带随机盐的慢哈希无法建索引
 * 因此用无盐 SHA-256（GitHub personal access token 等系统的通行做法）。
 * 输入空间 2^256，无盐带来的碰撞/彩虹表风险可忽略。
 */
export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 常量时间比较两个十六进制摘要 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'))
  } catch {
    return false
  }
}

/** 生成文章 slug：时间戳 base36 + 随机后缀，保证 URL 稳定且不暴露自增 id */
export function generateSlug(): string {
  const time = Date.now().toString(36)
  const rand = randomBytes(3).toString('hex')
  return `${time}${rand}`
}
