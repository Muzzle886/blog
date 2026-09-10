import 'server-only'
import { cookies } from 'next/headers'
import type { NextResponse } from 'next/server'
import { prisma } from './prisma'
import { generateSessionId } from './crypto'
import { unauthorized } from './errors'
import type { PublicUser, Role } from './types'

/**
 * 会话方案：服务端生成随机 ID 存入 MySQL，通过 httpOnly Cookie 承载。
 * 相比 JWT 的优势：可服务端撤销、可列出登录设备、无需管理密钥。
 */

const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'blog_session'
const TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || '14')
const SECURE = process.env.COOKIE_SECURE === 'true'

export interface AuthContext {
  user: PublicUser
  role: Role
  sessionId: string
}

function ttlMs(): number {
  return TTL_DAYS * 24 * 60 * 60 * 1000
}

async function createSession(
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<{ id: string; expiresAt: Date }> {
  const id = generateSessionId()
  const expiresAt = new Date(Date.now() + ttlMs())
  await prisma.session.create({
    data: {
      id,
      userId,
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip?.slice(0, 64) ?? null,
    },
  })
  return { id, expiresAt }
}

/**
 * 创建会话并把 Cookie 写入响应。
 * 只通过响应头写 Cookie —— 在 Server Component 中调用 cookies().set 会抛错，
 * 统一走这里可以保证「写 Cookie」永远发生在 Route Handler / Server Action 内。
 */
export async function createSessionForUser(
  response: NextResponse,
  userId: number,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<string> {
  const { id, expiresAt } = await createSession(userId, meta)
  response.cookies.set({
    name: COOKIE_NAME,
    value: id,
    httpOnly: true,
    sameSite: 'lax',
    secure: SECURE,
    path: '/',
    expires: expiresAt,
  })
  return id
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

export function getSessionIdFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie')
  if (!header) return null
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=')
    if (key === COOKIE_NAME) return decodeURIComponent(rest.join('=')) || null
  }
  return null
}

/** 在 Server Component / Route Handler 中读取当前登录用户（未登录返回 null） */
export async function getCurrentUser(): Promise<PublicUser | null> {
  const sessionId = cookies().get(COOKIE_NAME)?.value
  return resolveSession(sessionId)
}

export async function resolveSession(sessionId: string | null | undefined): Promise<PublicUser | null> {
  if (!sessionId) return null
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    // 过期会话惰性清理
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined)
    return null
  }
  if (session.user.deletedAt) return null
  return toPublicUser(session.user)
}

/** 在 Route Handler 中获取登录态，未登录抛 401 */
export async function requireUser(request: Request): Promise<PublicUser> {
  const user = await resolveSession(getSessionIdFromRequest(request))
  if (!user) throw unauthorized()
  return user
}

export async function requireAdmin(request: Request): Promise<PublicUser> {
  const user = await requireUser(request)
  if (user.role !== 'ADMIN') {
    const { forbidden } = await import('./errors')
    throw forbidden('需要管理员权限')
  }
  return user
}

export async function destroySession(sessionId: string | null): Promise<void> {
  if (!sessionId) return
  await prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined)
}

export async function destroyAllSessions(userId: number): Promise<void> {
  await prisma.session.deleteMany({ where: { userId } })
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
