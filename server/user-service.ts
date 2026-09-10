import 'server-only'
import { scryptSync, randomBytes } from 'node:crypto'
import { prisma } from '@/lib/prisma'
import { conflict, notFound, unauthorized } from '@/lib/errors'
import { hashPassword, verifyPassword } from '@/lib/crypto'
import { toPublicUser } from '@/lib/auth'
import { toPublicProfile, type PublicProfile } from '@/lib/serializers'
import type { PublicUser } from '@/lib/types'

export interface RegisterInput {
  username: string
  email: string
  password: string
  nickname: string
}

/**
 * 用于「账号不存在」分支的固定哈希，让该分支与真实校验耗时相当。
 * 值本身无意义（随机输入的哈希），永远不会匹配任何密码。
 *
 * 惰性初始化：参数升到 N=2^17 后单次计算约 200ms，若放在模块加载时
 * 执行，每个进程冷启动都要多付一次这个成本。
 */
let dummyHash: string | null = null

function getDummyHash(): string {
  if (dummyHash !== null) return dummyHash
  try {
    const salt = randomBytes(16)
    const derived = scryptSync(randomBytes(32).toString('hex'), salt, 64, {
      N: 1 << 17,
      r: 8,
      p: 1,
      maxmem: 256 * 1024 * 1024,
    })
    dummyHash = `scrypt$${1 << 17}$8$1$${salt.toString('hex')}$${derived.toString('hex')}`
  } catch {
    // 极端环境（内存不足）下退化为不额外计算，不影响登录功能
    dummyHash = ''
  }
  return dummyHash
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

    /*
     * 「第一个用户成为管理员」必须在事务里判断：
     * count() 与 create() 分开执行时，空库上两个并发注册请求可能同时
     * 读到 0，于是产生两个管理员。这里用事务把判断与写入绑在一起。
     *
     * 另外 count 只统计未软删除的用户 —— 否则唯一的用户被软删除后，
     * 计数仍不为 0，系统将永远无法再产生管理员。
     */
    const user = await prisma.$transaction(async (tx) => {
      const activeUsers = await tx.user.count({ where: { deletedAt: null } })
      return tx.user.create({
        data: {
          username: input.username,
          email: input.email,
          nickname: input.nickname,
          passwordHash,
          role: activeUsers === 0 ? 'ADMIN' : 'USER',
        },
      })
    })
    return toPublicUser(user)
  },

  /** 登录：支持用户名或邮箱；密码错误与账号不存在返回同一提示，避免账号枚举 */
  /**
   * 登录校验。
   *
   * 两个刻意的设计：
   *  1. 账号不存在时也跑一次哈希计算（对固定假哈希），避免「存在则慢、
   *     不存在则快」的响应时间差被用来枚举账号
   *  2. 命中旧参数哈希时在登录成功后静默升级到当前 scrypt 参数，
   *     用户无感知，也不需要强制所有人改密
   */
  async authenticate(identifier: string, password: string): Promise<PublicUser> {
    const user = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: identifier }, { email: identifier }],
      },
    })

    if (!user) {
      // 与真实校验等价的开销，抹平「存在则慢、不存在则快」的时间差
      const dummy = getDummyHash()
      if (dummy) await verifyPassword(password, dummy)
      throw unauthorized('账号或密码错误')
    }

    const result = await verifyPassword(password, user.passwordHash)
    if (!result.valid) throw unauthorized('账号或密码错误')

    if (result.needsRehash) {
      // 后台升级，不阻塞登录；失败也不影响本次登录
      hashPassword(password)
        .then((passwordHash) =>
          prisma.user.update({ where: { id: user.id }, data: { passwordHash } }),
        )
        .catch((error) => console.warn('[user] 密码哈希升级失败:', error))
    }

    return toPublicUser(user)
  },

  async getById(id: number): Promise<PublicUser> {
    const user = await prisma.user.findFirst({ where: { id, deletedAt: null } })
    if (!user) throw notFound('用户不存在')
    return toPublicUser(user)
  },

  /**
   * 公开主页：用户名 -> 用户信息 + 已发布文章数。
   *
   * 这个接口无需登录即可访问，因此返回 PublicProfile（不含 email/role）。
   * 之前误用了 toPublicUser，导致任何人遍历用户名就能批量收集邮箱，
   * 并识别出管理员账号。
   */
  async getProfileByUsername(
    username: string,
  ): Promise<{ user: PublicProfile; postCount: number }> {
    const user = await prisma.user.findFirst({ where: { username, deletedAt: null } })
    if (!user) throw notFound('用户不存在')
    const postCount = await prisma.post.count({
      where: { authorId: user.id, deletedAt: null, status: 'PUBLISHED' },
    })
    return { user: toPublicProfile(user), postCount }
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

  /**
   * 修改密码。
   * 调用方（路由）负责撤销该用户的全部会话 —— 这一步不能省，
   * 否则被盗账号改密后攻击者的会话仍然有效。
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) throw notFound('用户不存在')

    const result = await verifyPassword(currentPassword, user.passwordHash)
    if (!result.valid) throw unauthorized('当前密码不正确')
    if (currentPassword === newPassword) throw conflict('新密码不能与当前密码相同')

    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(newPassword) },
    })
  },
}
