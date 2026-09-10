/**
 * 大小写一致性检查。
 *
 * macOS/Windows 的文件系统不区分大小写，因此 `import '@/components/Header'`
 * 指向磁盘上的 `header.tsx` 在本地能跑通，但部署到 Linux（CI、Docker）
 * 会直接报模块找不到。本脚本逐条校验 import 路径的每一段是否与磁盘完全一致。
 *
 *   pnpm exec tsx scripts/check-case.ts
 */
import { readdirSync, existsSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const EXTS = ['.ts', '.tsx', '.css', '.json']

interface Problem {
  file: string
  specifier: string
  detail: string
}

function readDirSafe(dir: string): string[] {
  try {
    return readdirSync(dir)
  } catch {
    return []
  }
}

/**
 * 逐段校验路径大小写。
 *
 * 中间段必须是目录；最后一段既可能是文件（含扩展名在磁盘上），
 * 也可能是目录（此时再找 index.ts/tsx）。因此每一段都要同时尝试
 * 「目录名」与「去掉扩展名的文件主干名」两种匹配。
 */
function resolveWithCaseCheck(
  fromDir: string,
  specifier: string,
): { path: string } | { detail: string } {
  const segments = specifier.split('/').filter((segment) => segment && segment !== '.')
  let current = fromDir

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index]
    const isLast = index === segments.length - 1
    const entries = readDirSafe(current)

    // 1) 目录名精确匹配（中间段必然是目录）
    if (entries.includes(segment) && statSync(join(current, segment)).isDirectory()) {
      current = join(current, segment)
      if (isLast) {
        for (const ext of ['.ts', '.tsx']) {
          const indexPath = join(current, `index${ext}`)
          if (existsSync(indexPath)) return { path: indexPath }
        }
        return { detail: `目录「${segment}」下没有 index.ts/tsx` }
      }
      continue
    }

    // 2) 文件名匹配（最后一段）：带扩展名 或 主干名 + 扩展名
    if (isLast) {
      const candidates = entries.filter((entry) => {
        if (entry === segment) return true
        if (!entry.startsWith(`${segment}.`)) return false
        return EXTS.some((ext) => entry === `${segment}${ext}`)
      })
      if (candidates.length > 0) {
        return { path: join(current, candidates[0]) }
      }
    }

    // 3) 全部未命中：尝试给出大小写不一致的提示
    const normalized = segment.toLowerCase()
    const ciMatch = entries.find((entry) => {
      if (entry.toLowerCase() === normalized) return true
      return EXTS.some((ext) => entry.toLowerCase() === `${normalized}${ext}`)
    })
    if (ciMatch) {
      return {
        detail: `「${segment}」在磁盘上是「${ciMatch}」——本地大小写不敏感能跑通，Linux/CI 会模块找不到`,
      }
    }
    return { detail: `路径段「${segment}」在 ${current.replace(ROOT, '.')} 下不存在` }
  }

  return { detail: '空 import 路径' }
}

const files = execSync("git ls-files '*.ts' '*.tsx'", { encoding: 'utf8' })
  .split('\n')
  .filter(Boolean)

const problems: Problem[] = []
let checked = 0

/**
 * 去掉注释后再扫描。
 * 否则本文件开头的说明文字（以及任何在注释里举例的 import 写法）
 * 都会被当成真实 import —— 这个脚本最初就是这样误报自己的。
 */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')
}

for (const file of files) {
  // git 索引可能还列着已删除但尚未提交的文件（例如刚删掉一个路由），
  // 直接 readFileSync 会 ENOENT 崩掉整个检查
  if (!existsSync(file)) continue

  // 用 readFileSync 而不是 execSync(`cat ...`)：
  // 后者把「git 里的文件名」拼进 shell 命令，而 JSON.stringify 只转义
  // 双引号与反斜杠，不转义反引号与 $()。一个带反引号的文件名就能在
  // CI 上执行任意命令。直接读文件可以彻底移除这个面。
  const raw = readFileSync(file, 'utf8')
  const source = stripComments(raw)
  const importRe = /(?:from|import)\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null

  while ((match = importRe.exec(source)) !== null) {
    const specifier = match[1]
    if (!specifier.startsWith('.') && !specifier.startsWith('@/')) continue

    checked += 1
    // "@/x" 映射到仓库根目录；"./x" 相对于当前文件所在目录
    const baseDir = specifier.startsWith('@/')
      ? ROOT
      : dirname(resolve(ROOT, file))
    const target = specifier.startsWith('@/') ? specifier.slice(2) : specifier

    const result = resolveWithCaseCheck(baseDir, target)
    if ('detail' in result) {
      problems.push({ file, specifier, detail: result.detail })
    }
  }
}

console.log(`检查了 ${files.length} 个文件中的 ${checked} 条 imports\n`)

if (problems.length === 0) {
  console.log('\x1b[32m✓ 所有 import 路径的大小写与磁盘完全一致\x1b[0m')
} else {
  console.log(`\x1b[31m✗ 发现 ${problems.length} 处大小写不一致：\x1b[0m\n`)
  for (const problem of problems) {
    console.log(`  ${problem.file}`)
    console.log(`    import '${problem.specifier}'`)
    console.log(`    -> ${problem.detail}\n`)
  }
  process.exitCode = 1
}
