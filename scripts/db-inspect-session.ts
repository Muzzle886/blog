/**
 * 会话存储核查（供 scripts/security-check.sh 调用）。
 *
 *   pnpm exec tsx scripts/db-inspect-session.ts <cookie 中的原始令牌>
 *
 * 判定该令牌是否「没有被明文存储」：
 *   - 数据库里不存在 id 等于该令牌的行
 *   - 数据库里存在 id 等于该令牌 SHA-256 摘要的行
 * 两者同时成立输出 HASHED_OK，否则输出具体原因。
 * 只读，不修改任何数据。
 */
import { PrismaClient } from '@prisma/client'
import { createHash } from 'node:crypto'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const token = process.argv[2]
  if (!token) {
    console.log('MISSING_TOKEN')
    return
  }

  const asRaw = await prisma.session.findUnique({ where: { id: token } })
  if (asRaw) {
    console.log('PLAINTEXT_STORED')
    return
  }

  const digest = createHash('sha256').update(token).digest('hex')
  const asHash = await prisma.session.findUnique({ where: { id: digest } })
  if (!asHash) {
    console.log('NOT_FOUND_EITHER_WAY')
    return
  }

  console.log('HASHED_OK')
}

main()
  .catch(() => console.log('INSPECT_ERROR'))
  .finally(() => prisma.$disconnect())
