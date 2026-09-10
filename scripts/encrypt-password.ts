/**
 * 命令行口令加密工具。
 *
 *   pnpm exec tsx scripts/encrypt-password.ts <明文口令> [base_url]
 *
 * 把口令加密成与前端完全一致的信封（rsa-oaep-sha256:<keyId>:<base64>）并
 * 打印到 stdout，供 shell 验收脚本使用 —— 这样 e2e/security 脚本不需要
 * 内嵌任何加密逻辑，也不需要为了测试而在服务端开「接受明文」的后门。
 */
import { constants, createPublicKey, publicEncrypt } from 'node:crypto'
import type { KeyObject } from 'node:crypto'

/** createPublicKey 的 jwk 入参类型（绕开 DOM/Node 的 JsonWebKey 定义冲突） */
type CryptoKeyInput = Parameters<typeof createPublicKey>[0]

const ENVELOPE_PREFIX = 'rsa-oaep-sha256'

async function main(): Promise<void> {
  const plaintext = process.argv[2]
  const baseUrl = process.argv[3] ?? 'http://localhost:3000'

  if (!plaintext) {
    console.error('用法: tsx scripts/encrypt-password.ts <明文口令> [base_url]')
    process.exit(1)
  }

  const response = await fetch(`${baseUrl}/api/auth/public-key`, { cache: 'no-store' })
  if (!response.ok) {
    console.error(`获取公钥失败: HTTP ${response.status}`)
    process.exit(1)
  }

  const payload = (await response.json()) as {
    data: { keyId: string; publicKey: JsonWebKey }
  }
  const { keyId, publicKey } = payload.data

  /*
   * tsconfig 同时包含 DOM 与 Node 的类型，两边的 JsonWebKey 定义不同，
   * 直接传会报类型不兼容。这里显式断言为 crypto 的入参类型。
   */
  const key = createPublicKey({ key: publicKey, format: 'jwk' } as CryptoKeyInput)
  const ciphertext = publicEncrypt(
    { key, padding: constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' },
    Buffer.from(plaintext, 'utf8'),
  )

  // 只输出信封本身，方便 shell 用 $(...) 捕获
  process.stdout.write(`${ENVELOPE_PREFIX}:${keyId}:${ciphertext.toString('base64')}`)
}

main().catch((error: unknown) => {
  console.error('加密失败:', error instanceof Error ? error.message : error)
  process.exit(1)
})
