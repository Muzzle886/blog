import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
) => Promise<Buffer>

const KEY_LENGTH = 64
const SALT_BYTES = 16

/**
 * 密码哈希：scrypt（Node 内置，无原生依赖）
 * 存储格式：scrypt$<saltHex>$<hashHex>
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES)
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1], 'hex')
  const expected = Buffer.from(parts[2], 'hex')
  if (expected.length !== KEY_LENGTH) return false
  const derived = await scrypt(password, salt, KEY_LENGTH)
  return timingSafeEqual(derived, expected)
}

/** 生成不可预测的会话 ID */
export function generateSessionId(): string {
  return randomBytes(32).toString('hex')
}

/** 生成文章 slug：时间戳 base36 + 随机后缀，保证 URL 稳定且不暴露自增 id */
export function generateSlug(): string {
  const time = Date.now().toString(36)
  const rand = randomBytes(3).toString('hex')
  return `${time}${rand}`
}
