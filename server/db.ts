import 'server-only'
import type { Prisma, PrismaClient } from '@prisma/client'
import { prisma } from '@/lib/prisma'

/**
 * 统一的可选 Prisma 客户端参数。
 * 允许在事务中复用同一个 client，保证「标签 + 文章」写入的原子性。
 */
export type Db = PrismaClient | Prisma.TransactionClient

export function db(client?: Db): Db {
  return client ?? prisma
}
