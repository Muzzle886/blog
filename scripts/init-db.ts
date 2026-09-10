/**
 * 数据库初始化脚本：在测试 MySQL 实例上创建目标库。
 *
 *   pnpm db:init
 *
 * 从 DATABASE_URL 解析连接信息，连接到实例（不指定 database）后
 * CREATE DATABASE IF NOT EXISTS，字符集固定 utf8mb4（中文与 emoji 必需）。
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import mysql from 'mysql2/promise'

/** 极简 .env 读取（避免为脚本引入 dotenv 依赖） */
function loadEnv(): void {
  const path = resolve(process.cwd(), '.env')
  let content: string
  try {
    content = readFileSync(path, 'utf8')
  } catch {
    return
  }
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue
    const index = line.indexOf('=')
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    let value = line.slice(index + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    if (process.env[key] === undefined) process.env[key] = value
  }
}

async function main(): Promise<void> {
  loadEnv()

  const url = process.env.DATABASE_URL
  if (!url) {
    console.error('✗ 缺少 DATABASE_URL，请先复制 .env.example 为 .env')
    process.exit(1)
  }

  const parsed = new URL(url)
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ''))
  if (!database) {
    console.error('✗ DATABASE_URL 中未指定数据库名')
    process.exit(1)
  }

  const connection = await mysql.createConnection({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    connectTimeout: 10_000,
  })

  const [rows] = await connection.query('SELECT VERSION() AS version')
  const version = (rows as { version: string }[])[0]?.version
  console.log(`✓ 已连接 MySQL ${version} @ ${parsed.hostname}:${parsed.port}`)

  await connection.query(
    `CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  )
  console.log(`✓ 数据库 \`${database}\` 就绪（utf8mb4 / utf8mb4_unicode_ci）`)

  await connection.end()
}

main().catch((error: unknown) => {
  console.error('✗ 数据库初始化失败：', error instanceof Error ? error.message : error)
  process.exit(1)
})
