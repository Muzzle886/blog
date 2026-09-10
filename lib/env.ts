/**
 * 极简 .env 读取（供脚本使用，避免为此引入 dotenv 依赖）。
 *
 * 已存在的 process.env 优先，不会被文件覆盖 ——
 * 这样命令行传入的变量依然生效：`SEED_ADMIN_PASSWORD=x pnpm test:design`
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function loadEnv(file = '.env'): void {
  let content: string
  try {
    content = readFileSync(resolve(process.cwd(), file), 'utf8')
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

export interface DemoCredentials {
  identifier: string
  password: string
}

/**
 * 取演示管理员凭据。
 *
 * 刻意**不内置任何口令默认值** —— 验收脚本会随源码提交，
 * 把口令写进代码等同于把它写进仓库。缺失时直接给出可操作的提示。
 */
export function requireAdminCredentials(): DemoCredentials {
  const identifier = process.env.SEED_ADMIN_USER || 'muzzle'
  const password = process.env.SEED_ADMIN_PASSWORD

  if (!password) {
    throw new Error(
      '缺少 SEED_ADMIN_PASSWORD。验收脚本需要管理员口令来登录。\n' +
        '  方式一：在 .env 中设置 SEED_ADMIN_PASSWORD=... （推荐，脚本会自动读取）\n' +
        '  方式二：命令行传入 SEED_ADMIN_PASSWORD=... 后再执行\n' +
        '  忘记口令：重跑 pnpm db:seed 会在输出里打印，或用同样变量重设。',
    )
  }

  return { identifier, password }
}
