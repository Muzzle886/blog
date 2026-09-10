/**
 * 主题初始化脚本：在 <head> 中同步执行，避免深色模式闪白。
 * 优先级：localStorage > prefers-color-scheme
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
