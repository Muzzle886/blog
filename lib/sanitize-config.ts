/**
 * Markdown 清洗配置（服务端渲染与客户端预览共用）。
 *
 * 为什么把配置抽到独立模块而不是各写一份：
 * 之前 lib/markdown.ts 与 components/markdown-preview.tsx 各维护一份
 * 完全相同的配置，两处一旦漂移就会出现「预览安全但线上不安全」或者
 * 反过来的情况。这里作为唯一定义点，两边 import 同一个对象。
 *
 * `server-only` 不能加在这里 —— 客户端预览组件也要用。
 */
import createDOMPurify, { type Config } from 'dompurify'

/**
 * 允许的标签。刻意不含 script/style/iframe/form/object/embed。
 * `input` 仅用于 Markdown 任务列表（GFM tasklist）的复选框。
 */
const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'p', 'br', 'hr', 'blockquote', 'pre', 'code',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'a', 'strong', 'em', 'del', 's', 'sub', 'sup', 'mark', 'kbd', 'abbr',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'figure', 'figcaption',
  'span', 'div', 'input',
]

const ALLOWED_ATTR = [
  'href', 'title', 'alt', 'src', 'class', 'id',
  'align', 'colspan', 'rowspan', 'target', 'rel',
  'type', 'checked', 'disabled', 'start',
]

export const PURIFY_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR,
  /*
   * 只允许 http/https/mailto/tel/锚点/站内相对路径。
   *
   * 注意：DOMPurify 对 `data:` 有独立分支（DATA_URI_TAGS，img 在其中），
   * 该分支在 URI 正则之前生效，所以这个正则**并不能**拦住
   * `<img src="data:text/html;base64,...">`。要真正拦住必须靠下面的钩子，
   * 否则配置看起来比实际严格（实测 data: 会原样保留）。
   */
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i,
  FORBID_TAGS: ['style', 'script', 'iframe', 'form', 'object', 'embed'],
  FORBID_ATTR: ['style', 'onerror', 'onload', 'onclick'],
}

/**
 * data: URI 白名单（仅用于内联图片）。
 * 只放行常见位图格式 —— 排除 image/svg+xml 与 text/html，
 * 这两者虽然不会在 <img> 上下文里执行脚本，但没有理由在博客正文里出现。
 */
const SAFE_DATA_URI = /^data:image\/(png|jpe?g|gif|webp|avif);base64,[a-z0-9+/=\s]+$/i

/** 在给定 DOMPurify 实例上安装钩子（服务端与客户端各装一次） */
export function installPurifyHooks(purify: ReturnType<typeof createDOMPurify>): void {
  purify.addHook('afterSanitizeAttributes', (node) => {
    if (node.nodeName !== 'IMG') return
    const src = node.getAttribute('src')
    if (!src) return
    if (src.toLowerCase().startsWith('data:') && !SAFE_DATA_URI.test(src)) {
      node.removeAttribute('src')
    }
  })
}
