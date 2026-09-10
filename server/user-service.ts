import 'server-only'
import { prisma } from '@/lib/prisma'
import { conflict, notFound, unauthorized } from '@/lib/errors'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { toPublicUser } from '@/lib/auth'
import type { PublicUser } from '@/lib/types'

export interface RegisterInput {
  username: string
  email: string
  password: string
  nickname: string
}

export const userService = {
  /**
   * 注册。用户名/邮箱重复返回 409。
   * 系统第一个注册用户自动成为管理员，方便自建博客初始化。
   */
  async register(input: RegisterInput): Promise<PublicUser> {
    const existing = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: input.username }, { email: input.email }],
      },
      select: { username: true, email: true },
    })
    if (existing) {
      throw conflict(
        existing.username === input.username ? '用户名已被占用' : '邮箱已被注册',
      )
    }

    const passwordHash = await hashPassword(input.password)
    const userCount = await prisma.user.count()

    const user = await prisma.user.create({
      data: {
        username: input.username,
        email: input.email,
        nickname: input.nickname,
        passwordHash,
        role: userCount === 0 ? 'ADMIN' : 'USER',
      },
    })
    return toPublicUser(user)
  },

  /** 登录：支持用户名或邮箱；密码错误与账号不存在返回同一提示，避免账号枚举 */
  async authenticate(identifier: string, password: string): Promise<PublicUser> {
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: identifier }, { email: identifier }],
      },
    })
    if (!user) throw unauthorized('账号或密码错误')

    const valid = await verifyPassword(password, user.passwordHash)
    if (!valid) throw unauthorized('账号或密码错误')

    return toPublicUser(user)
  },

  async getById(id: number): Promise<PublicUser> {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!user) throw notFound('用户不存在')
    return toPublicUser(user)
  },

  /** 公开主页：用户名 -> 用户信息 + 已发布文章数 */
  async getProfileByUsername(
    username: string,
  ): Promise<{ user: PublicUser; postCount: number }> {
    const user = await prisma.user.findFirst({ where: { username, deletedAt: null } })
    if (!user) throw notFound('用户不存在')
    const postCount = await prisma.post.count({
      where: { authorId: user.id, deletedAt: null, status: 'PUBLISHED' },
    })
    return { user: toPublicUser(user), postCount }
  },

  async updateProfile(
    userId: number,
    input: { nickname?: string; bio?: string | null; email?: string },
  ): Promise<PublicUser> {
    if (input.email) {
      const taken = await prisma.user.findFirst({
        where: { email: input.email, id: { not: userId }, deletedAt: null },
      })
      if (taken) throw conflict('邮箱已被注册')
    }
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(input.nickname !== undefined ? { nickname: input.nickname } : {}),
        ...(input.bio !== undefined ? { bio: input.bio } : {}),
        ...(input.email !== undefined ? { email: input.email } : {}),
      },
    })
    return toPublicUser(user)
  },

  /** 修改密码：校验旧密码，成功后由调用方销毁其它会话 */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw notFound('用户不存在')
    const valid = await verifyPassword(currentPassword, user.passwordHash)
    if (!valid) throw unauthorized('当前密码不正确')
    if (currentPassword === newPassword) throw conflict('新密码不能与当前密码相同')
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    })
  },
}
