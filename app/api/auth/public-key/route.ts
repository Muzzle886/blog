import { ok, route } from '@/lib/http'
import { getPublicKeyPayload } from '@/lib/password-crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/public-key — 取得用于加密口令的 RSA 公钥
 *
 * 无需鉴权（登录前就要用）。响应里带 keyId，客户端加密时写进信封，
 * 服务端据此选择对应私钥；轮换公钥后旧 keyId 仍可解（保留上一把私钥）。
 */
export const GET = route(async () => {
  return ok(getPublicKeyPayload())
})
