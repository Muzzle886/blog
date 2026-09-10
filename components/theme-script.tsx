/**
 * 主题初始化脚本：在 <head> 中同步执行，避免深色模式闪白。
 * 优先级：localStorage > prefers-color-scheme
 *
 * 必须内联在 <head>：放到外部文件会在首帧之后才执行，产生闪白。
 * 之前为了让这段脚本通过 CSP 还需要 nonce，现在不再下发 CSP，
 * 因此这里也不需要任何 nonce 相关的处理。
 */
export function ThemeScript() {
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

  return <script dangerouslySetInnerHTML={{ __html: script }} />
}
