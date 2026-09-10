import { headers } from 'next/headers'

/**
 * 主题初始化脚本：在 <head> 中同步执行，避免深色模式闪白。
 * 优先级：localStorage > prefers-color-scheme
 *
 * 这段脚本必须内联在 <head>（放到外部文件就会在首帧之后才执行，产生闪白），
 * 因此需要中间件下发的 nonce 才能通过 CSP。
 * nonce 由 middleware.ts 通过请求头 x-nonce 透传。
 */
export function ThemeScript({ nonce }: { nonce?: string }) {
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

/** 读取中间件下发的 nonce（服务端组件中调用） */
export function getNonce(): string | undefined {
  return headers().get('x-nonce') ?? undefined
}
