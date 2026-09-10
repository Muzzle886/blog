/**
 * 浏览器侧的口令加密（Web Crypto / RSA-OAEP-SHA256）。
 *
 * 与服务端 lib/password-crypto.ts 的信封格式严格对应：
 *   rsa-oaep-sha256:<keyId>:<base64>
 *
 * 只用浏览器原生 crypto.subtle，不引入任何加密库。
 */

const ENVELOPE_PREFIX = 'rsa-oaep-sha256'

interface PublicKeyPayload {
  keyId: string
  algorithm: string
  publicKey: JsonWebKey
}

function base64FromBuffer(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export interface PasswordCipher {
  /** 加密并返回信封字符串 */
  encrypt: (plaintext: string) => Promise<string>
  keyId: string
}

/** 取公钥并准备好加密函数 */
export async function createCipher(): Promise<PasswordCipher> {
  if (typeof crypto === 'undefined' || !crypto.subtle) {
    throw new Error('当前浏览器不支持 Web Crypto，无法加密密码')
  }

  const response = await fetch('/api/auth/public-key', { cache: 'no-store' })
  if (!response.ok) throw new Error('无法获取加密公钥')

  const payload = (await response.json()) as { data: PublicKeyPayload }
  const { keyId, publicKey } = payload.data

  const key = await crypto.subtle.importKey(
    'jwk',
    publicKey,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt'],
  )

  return {
    keyId,
    async encrypt(plaintext: string) {
      const encoded = new TextEncoder().encode(plaintext)
      const ciphertext = await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, key, encoded)
      return `${ENVELOPE_PREFIX}:${keyId}:${base64FromBuffer(ciphertext)}`
    },
  }
}

/**
 * 预取公钥的 hook 所使用的模块级缓存。
 *
 * 公钥的有效期是 12 小时，而登录/注册/改密都是低频操作，
 * 因此进程内缓存一次即可，避免每次进入页面都多一个请求。
 */
let cached: PasswordCipher | null = null

export async function getCipher(): Promise<PasswordCipher> {
  if (!cached) cached = await createCipher()
  return cached
}

/** 加密失败（例如公钥已轮换）时清掉缓存，下次重新取 */
export function resetCipher(): void {
  cached = null
}
