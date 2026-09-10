/** slug / 标签名归一化工具 */

/** 中文等非 ASCII 字符无法直接做 slug，统一转拼音不现实，改用「保留字母数字 + 短哈希」策略 */
export function slugifyTag(name: string): string {
  const normalized = name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u4e00-\u9fa5-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  if (!normalized) return `tag-${hash(name)}`
  // 含中文时附加哈希，保证唯一性与 URL 可读性的平衡
  if (/[\u4e00-\u9fa5]/.test(normalized)) {
    return `${encodeURIComponent(normalized)}-${hash(name)}`
  }
  return normalized.slice(0, 40)
}

function hash(input: string): string {
  let h = 5381
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 33) ^ input.charCodeAt(i)
  }
  return (h >>> 0).toString(36).slice(0, 6)
}

/** 归一化标签：去空白、去重（大小写不敏感）、限制数量 */
export function normalizeTags(tags: string[] | undefined, max = 8): string[] {
  if (!tags) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const raw of tags) {
    const name = raw.trim().replace(/\s+/g, ' ')
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(name)
    if (result.length >= max) break
  }
  return result
}
