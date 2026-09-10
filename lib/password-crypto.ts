import 'server-only'
import {
  constants,
  createHash,
  generateKeyPairSync,
  privateDecrypt,
  type KeyObject,
} from 'node:crypto'

/**
 * 密码传输加密（RSA-OAEP + SHA-256）。
 *
 * 起因：登录/注册时密码以明文 JSON 提交，任何能看到请求体的人
 * （浏览器 devtools、日志、代理、中间设备）都能直接读到口令。
 *
 * 方案与边界（必须说清楚，避免高估它的作用）：
 *  - 浏览器用公钥加密，服务端用私钥解密，因此**请求体里不再有明文口令**
 *  - 它**不能**替代 HTTPS：只能防「明文传输」，不防中间人替换公钥。
 *    真正的传输安全仍然依赖 TLS。
 *  - 也不能防同一页面内注入的脚本（那种情况下脚本可以直接读表单）
 *  - 公钥轮换期间保留上一把私钥，避免缓存了旧公钥的页面立刻失效
 */

/** 信封前缀：自描述算法，服务端可据此拒绝明文或算法不符的输入 */
export const ENVELOPE_PREFIX = 'rsa-oaep-sha256'

const KEY_BYTES = 2048
/** 轮换周期：到期后在下次取公钥时生成新密钥对 */
const ROTATE_MS = 12 * 60 * 60 * 1000

interface KeyPair {
  publicKey: KeyObject
  privateKey: KeyObject
  keyId: string
  createdAt: number
}

/*
 * 密钥对挂在 globalThis 上而不是模块作用域。
 *
 * 原因是一个实际踩到的坑：dev 模式下 Next 的 HMR 会重新执行模块，
 * 模块级变量随之丢失并生成**新的密钥对**。于是「页面取公钥」与
 * 「提交表单」之间只要发生一次重编译，keyId 就对不上了，
 * 表现为 "加密密钥已更新" —— 功能看起来能用，但会随机失败。
 * 生产模式模块只加载一次，影响不大；但测试与开发都会踩到。
 */
interface KeyStore {
  current: KeyPair | null
  previous: KeyPair | null
}

const globalForKeys = globalThis as unknown as { __passwordKeyStore?: KeyStore }
const store: KeyStore = (globalForKeys.__passwordKeyStore ??= { current: null, previous: null })

function createKeyPair(): KeyPair {
  /*
   * 不传 publicKeyEncoding/privateKeyEncoding —— 一旦传入，Node 返回的是
   * PEM 字符串而不是 KeyObject，后续 export({format:'jwk'}) 与
   * privateDecrypt 都会失败。这里要的就是 KeyObject。
   */
  const { publicKey, privateKey } = generateKeyPairSync('rsa', {
    modulusLength: KEY_BYTES,
  })

  // keyId 由公钥的 DER 编码派生（比 PEM 稳定，不受换行/头尾影响）
  const der = publicKey.export({ format: 'der', type: 'spki' })
  const keyId = createHash('sha256').update(der).digest('hex').slice(0, 16)

  return { publicKey, privateKey, keyId, createdAt: Date.now() }
}

/**
 * 取得当前密钥对，必要时轮换。
 *
 * 注意：generateKeyPairSync 是**同步**的，2048 位生成约需 50–200ms。
 * 因此不能每个请求都生成 —— 这里缓存在模块作用域，
 * 且只在「取公钥」这个低频入口触发。
 */
function getKeyPair(): KeyPair {
  const now = Date.now()
  if (!store.current) {
    store.current = createKeyPair()
    return store.current
  }
  if (now - store.current.createdAt > ROTATE_MS) {
    store.previous = store.current
    store.current = createKeyPair()
  }
  return store.current
}

export interface PublicKeyPayload {
  keyId: string
  algorithm: string
  publicKey: JsonWebKey
  /** 距下次轮换的毫秒数，客户端可据此决定缓存时长 */
  rotateInMs: number
}

export function getPublicKeyPayload(): PublicKeyPayload {
  const pair = getKeyPair()
  const publicKey = pair.publicKey.export({ format: 'jwk' }) as JsonWebKey
  return {
    keyId: pair.keyId,
    algorithm: 'RSA-OAEP-256',
    publicKey,
    rotateInMs: Math.max(0, ROTATE_MS - (Date.now() - pair.createdAt)),
  }
}

export type DecryptResult =
  | { ok: true; plaintext: string }
  | { ok: false; reason: 'malformed' | 'unknown_key' | 'decrypt_failed' }

/**
 * 解密 `rsa-oaep-sha256:<keyId>:<base64>` 信封。
 *
 * 明文输入会以 malformed 拒绝 —— 这样「是否真的加密了」由服务端强制，
 * 而不是只靠前端自觉（前端加密很容易被绕过或漏改）。
 */
export function decryptPassword(envelope: unknown): DecryptResult {
  if (typeof envelope !== 'string') return { ok: false, reason: 'malformed' }

  const first = envelope.indexOf(':')
  if (first === -1) return { ok: false, reason: 'malformed' }

  const algorithm = envelope.slice(0, first)
  if (algorithm !== ENVELOPE_PREFIX) return { ok: false, reason: 'malformed' }

  const rest = envelope.slice(first + 1)
  const second = rest.indexOf(':')
  if (second === -1) return { ok: false, reason: 'malformed' }

  const keyId = rest.slice(0, second)
  const base64 = rest.slice(second + 1)
  if (!keyId || !base64) return { ok: false, reason: 'malformed' }

  // 允许上一把私钥继续解（公钥轮换后仍有页面缓存着旧公钥）
  const candidate =
    store.current && store.current.keyId === keyId
      ? store.current
      : store.previous && store.previous.keyId === keyId
        ? store.previous
        : null
  if (!candidate) return { ok: false, reason: 'unknown_key' }

  let ciphertext: Buffer
  try {
    ciphertext = Buffer.from(base64, 'base64')
  } catch {
    return { ok: false, reason: 'malformed' }
  }
  if (ciphertext.length === 0) return { ok: false, reason: 'malformed' }

  try {
    const plaintext = privateDecrypt(
      {
        key: candidate.privateKey,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: 'sha256',
      },
      ciphertext,
    )
    return { ok: true, plaintext: plaintext.toString('utf8') }
  } catch {
    // 密文被篡改、或用了另一把密钥
    return { ok: false, reason: 'decrypt_failed' }
  }
}
