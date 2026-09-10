import { PrismaClient } from '@prisma/client'

/**
 * Prisma 客户端单例。
 * 开发环境下 Next.js 的模块热替换会重复实例化，挂到 globalThis 上避免连接泄漏。
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
