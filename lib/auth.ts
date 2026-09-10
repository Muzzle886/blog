import 'server-only'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { generateSessionToken, hashSessionToken } from './crypto'
import { unauthorized } from './errors'
import type { PublicUser, Role } from './types'

/**
 * 会话方案：服务端会话表 + httpOnly Cookie。
 *
 * 与 JWT 的取舍：可服务端撤销、可列出/踢出登录设备、无需管理签名密钥；
 * 代价是每个带登录态的请求多一次主键查询（实测 ~1ms，见 README）。
 *
 * 安全设计要点：
 *  1. Cookie 里是 256 位随机令牌；数据库只存它的 SHA-256 摘要，
 *     库被读走也无法直接用于认证（详见 lib/crypto.ts 的说明）
 *  2. 双重过期：expiresAt 绝对超时 + lastUsedAt 空闲超时
 *  3. 改密码等敏感操作会撤销该用户的全部会话（destroyAllSessions）
 *  4. 过期会话在登录时机会性清理（throttled），避免表无限增长
 */

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'blog_session'
/** 绝对有效期（天）：无论是否活跃，到点即失效 */
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || '14')
/** 空闲超时（天）：连续多久未使用则失效 */
const IDLE_DAYS = Number(process.env.SESSION_IDLE_DAYS || '7')
const SECURE = process.env.COOKIE_SECURE === 'true'

/**
 * 生产环境必须开启 Secure，否则 14 天有效期的会话令牌会随明文 HTTP 请求
 * 暴露在链路上，攻击者拿到即可完全接管账号。
 * 这里选择「启动即失败」而不是静默降级 —— 配置错误应该在部署时暴露，
 * 而不是在被人抓包之后才发现。
 */
if (process.env.NODE_ENV === 'production' && !SECURE) {
  throw new Error(
    '生产环境必须设置 COOKIE_SECURE=true（否则会话 Cookie 会在明文 HTTP 上泄露）。' +
      '即使 TLS 在反向代理处终止，也仍需开启该选项。',
  )
}

const DAY_MS = 24 * 60 * 60 * 1000

export interface AuthContext {
  user: PublicUser
  role: Role
  sessionId: string
}

function absoluteExpiry(): Date {
  return new Date(Date.now() + TTL_DAYS * DAY_MS)
}

function idleDeadline(): Date {
  return new Date(Date.now() - IDLE_DAYS * DAY_MS)
}

/* ======================= 过期会话清理 ======================= */

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000
let lastCleanupAt = 0

/**
 * 清理已过期会话。
 * 没有引入定时任务（会多一个部署依赖），改为在登录时机会性触发，
 * 服务进程内 10 分钟最多执行一次。
 */
async function cleanupExpiredSessions(): Promise<void> {
  const now = Date.now()
  if (now - lastCleanupAt < CLEANUP_INTERVAL_MS) return
  lastCleanupAt = now
  try {
    const result = await prisma.session.deleteMany({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { lastUsedAt: { lt: idleDeadline() } }],
      },
    })
    if (result.count > 0) {
      console.info(`[auth] 清理过期会话 ${result.count} 条`)
    }
  } catch (error) {
    // 清理失败不应影响登录
    console.warn('[auth] 清理过期会话失败:', error)
  }
}

/* ======================= 会话生命周期 ======================= */

async function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ token: string; expiresAt: Date }> {
  const token = generateSessionToken()
  const expiresAt = absoluteExpiry()

  await prisma.session.create({
    data: {
      // 入库的是摘要，不是令牌本身
      id: hashSessionToken(token),
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    },
  })

  return { token, expiresAt }
}

/**
 * 创建会话并把 Cookie 写入响应。
 * 只通过响应头写 Cookie —— Server Component 中调用 cookies().set 会抛错，
 * 统一走这里可保证「写 Cookie」永远发生在 Route Handler 内。
 *
 * 返回值为令牌本身（仅用于必要时回显，绝不入库）。
 */
export async function createSessionForUser(
  response: NextResponse,
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  // 登录是低频操作，适合顺带做一次清理
  void cleanupExpiredSessions()

  const { token, expiresAt } = await createSession(userId, meta)
  response.cookies.set({
    name: COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    expires: expiresAt,
  })
  return token
}

export function clearSessionCookie(response: NextResponse): void {
  response.cookies.set({
    name: COOKIE_NAME,
    value: '',
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    maxAge: 0,
  })
}

export function getSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key !== COOKIE_NAME) continue
    const raw = rest.join('=')
    if (!raw) return null
    try {
      return decodeURIComponent(raw) || null
    } catch {
      // Cookie 是攻击者可控输入：`blog_session=%` 这类畸形值会让
      // decodeURIComponent 抛 URIError。这里必须吞掉并视为「无会话」，
      // 否则每个畸形 Cookie 都会变成一次 500 + 日志噪声。
      return null
    }
  }
  return null
}

/** 在 Server Component / Route Handler 中读取当前登录用户（未登录返回 null） */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  return resolveSession(token)
}

/**
 * 用 Cookie 中的令牌解析登录态。
 * 先做摘要再查库 —— 数据库里没有明文令牌，无法直接按令牌查询。
 */
export async function resolveSession(
  token: string | null | undefined,
): Promise<PublicUser | null> {
  if (!token || token.length !== 64) return null

  const sessionId = hashSessionToken(token)
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })
  if (!session) return null

  const now = Date.now()
  const expired = session.expiresAt.getTime() < now
  const idle = session.lastUsedAt.getTime() < idleDeadline().getTime()

  if (expired || idle) {
    // 惰性清理：这条会话已经被判定失效，顺手删掉
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.user.deletedAt) return null

  // 滑动续期：更新最近使用时间。低于 1 分钟的重复请求不写库，
  // 避免每个请求都产生一次写操作。
  if (now - session.lastUsedAt.getTime() > 60_000) {
    prisma.session
      .update({ where: { id: session.id }, data: { lastUsedAt: new Date() } })
      .catch((error) => console.warn('[auth] 更新 lastUsedAt 失败:', error))
  }

  return toPublicUser(session.user)
}

/** 在 Route Handler 中获取登录态，未登录抛 401 */
export async function requireUser(request: Request): Promise<PublicUser> {
  const user = await resolveSession(getSessionTokenFromRequest(request))
  if (!user) throw unauthorized()
  return user
}

/**
 * 要求管理员角色。
 *
 * 当前**没有调用点** —— 项目目前不存在「仅管理员可做」的操作：
 * /admin/* 页面只是「我的文章」，靠 postService 的 visibilityWhere()
 * 按 viewer 收敛数据，普通用户打开只会看到自己的文章。
 *
 * 保留它是因为角色已经存在于数据模型中。新增任何管理类接口时，
 * 必须显式调用本函数：**只在 layout 里挡登录是不够的**，
 * 页面级校验不覆盖 API 路由。
 */
export async function requireAdmin(request: Request): Promise<PublicUser> {
  const user = await requireUser(request)
  if (user.role !== 'ADMIN') {
    const { forbidden } = await import('./errors')
    throw forbidden('需要管理员权限')
  }
  return user
}

/* ======================= 会话撤销 ======================= */

/** 注销单个会话（登出） */
export async function destroySession(token: string | null): Promise<void> {
  if (!token) return
  await prisma.session
    .delete({ where: { id: hashSessionToken(token) } })
    .catch(() => undefined)
}

/**
 * 撤销该用户的全部会话。
 * 用于修改密码、检测到账号异常等场景 —— 光注销当前会话是不够的，
 * 否则被盗账号改密后，攻击者的会话仍然有效。
 */
export async function destroyAllSessions(userId: number): Promise<number> {
  const result = await prisma.session.deleteMany({ where: { userId } })
  return result.count
}

/** 撤销除当前会话外的其它会话（「退出其它设备」） */
export async function destroyOtherSessions(token: string | null, userId: number): Promise<number> {
  const currentId = token ? hashSessionToken(token) : null
  const result = await prisma.session.deleteMany({
    where: { userId, ...(currentId ? { id: { not: currentId } } : {}) },
  })
  return result.count
}

/** 列出当前用户的有效会话（用于「登录设备管理」） */
export async function listSessions(userId: number): Promise<
  { id: string; userAgent: string | null; ip: string | null; createdAt: Date; lastUsedAt: Date; expiresAt: Date }[]
> {
  return prisma.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    select: {
      id: true,
      userAgent: true,
      ip: true,
      createdAt: true,
      lastUsedAt: true,
      expiresAt: true,
    },
    orderBy: { lastUsedAt: 'desc' },
  })
}

export function toPublicUser(user: {
  id: number
  username: string
  nickname: string
  email: string
  bio: string | null
  role: Role
  createdAt: Date
}): PublicUser {
  return {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    email: user.email,
    bio: user.bio,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
  }
}

export { COOKIE_NAME }
