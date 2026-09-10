/**
 * 跳转目标安全化。
 *
 * 登录/注册后会把用户送回 `?redirect=` 指定的页面。如果直接把这个值
 * 交给 router.push，攻击者可以构造
 *   /login?redirect=https://evil.tld
 * 让用户在「刚登录成功」的心理状态下被跳到外部站点（钓鱼跳板）。
 *
 * 只允许站内相对路径：
 *  - 必须以单个 "/" 开头（"//evil.tld" 是协议相对 URL，必须排除）
 *  - 不能包含协议分隔符或反斜杠（某些浏览器会把 "\" 当作 "/"）
 *  - 不允许控制字符（防响应头/日志注入）
 */
export function safeRedirectPath(value: string | null | undefined, fallback = '/'): string {
  if (!value) return fallback

  const raw = value.trim()
  if (!raw) return fallback
  if (!raw.startsWith('/')) return fallback
  // "//host" 与 "/\host" 都会被浏览器解析为跨站
  if (raw.startsWith('//') || raw.startsWith('/\\')) return fallback
  if (raw.includes('\\')) return fallback
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback

  return raw
}
