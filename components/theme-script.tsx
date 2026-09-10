import { headers } from 'next/headers'

/**
 * 主题初始化脚本：在 <head> 中同步执行，避免深色模式闪白。
 * 优先级：localStorage > prefers-color-scheme
 *
 * 必须内联在 <head>：放到外部文件会在首帧之后才执行，产生闪白。
 *
 * nonce 的处理按环境区分，原因是一个实际的坑：
 * dev 模式下 Next 不会把 nonce 注入客户端 bundle，服务端渲染出
 * nonce=""、客户端却是真实值，React 会对每个脚本报
 * "Prop `nonce` did not match"。而 dev 的 CSP 本身就不使用 nonce
 * （见 middleware.ts 的说明），所以 dev 下干脆不输出该属性。
 */
export function ThemeScript() {
  const isDev = process.env.NODE_ENV !== 'production'
  const nonce = isDev ? undefined : headers().get('x-nonce') ?? undefined

  const script = `
(function () {
  try {
    var stored = localStorage.getItem('blog-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var dark = stored ? stored === 'dark' : prefersDark;
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (e) {}
})();
`.trim()

  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: script }} />
}
