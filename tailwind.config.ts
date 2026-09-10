import type { Config } from 'tailwindcss'

/**
 * 设计系统：编辑/杂志风格（typography-first）
 *
 * 三条硬规则（也是 design-audit 断言的对象）：
 *  1. **没有卡片**。内容不装进容器，层级只由字号、字重、留白和细分隔线建立。
 *     因此本文件不提供阴影/大圆角相关令牌，容器圆角仅有 2–4px 一档。
 *  2. **衬线标题 + 无衬线正文**。标题用衬线体形成"阅读型排版"的骨架。
 *  3. **暖色调**。纸白底 + 暖墨色字 + 赭石强调色，避免通用科技蓝。
 *
 * 色板刻意做得比常规 Tailwind 项目小：中性色只有 paper / ink 两组，
 * 每个语义只有 3–4 档（强/常规/弱/最弱），减少"多档灰但用不上"的噪声。
 */
const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* 纸感底色：不用纯白，降低长时间阅读的刺眼感 */
        paper: {
          DEFAULT: '#faf8f5',
          raised: '#fffefc',
          sunken: '#f2efe9',
        },
        /* 暖墨色文字：不用纯黑 */
        ink: {
          DEFAULT: '#191614',
          strong: '#0d0b0a',
          soft: '#4a443f',
          muted: '#736c64',
          faint: '#a39b92',
          line: '#e3ddd3',
          'line-strong': '#d2cabf',
        },
        /* 赭石/赤陶强调色：单一主色，克制使用（链接、focus、当前项标记） */
        accent: {
          DEFAULT: '#b0512a',
          strong: '#8f3f1f',
          soft: '#f5ece5',
        },
        /* 暗色模式：暖调深色，不用纯黑 */
        night: {
          DEFAULT: '#141210',
          raised: '#1c1917',
          sunken: '#0f0d0c',
          line: '#2f2a26',
          'line-strong': '#413a34',
        },
      },
      fontFamily: {
        /* 正文/界面：无衬线 */
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          '"PingFang SC"',
          '"Hiragino Sans GB"',
          '"Microsoft YaHei"',
          '"Source Han Sans SC"',
          'sans-serif',
        ],
        /* 标题/引文：衬线。中文优先宋体系，回退到系统衬线 */
        serif: [
          '"Songti SC"',
          '"Source Han Serif SC"',
          '"Noto Serif CJK SC"',
          '"STSong"',
          'SimSun',
          'Georgia',
          '"Times New Roman"',
          'serif',
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Consolas',
          '"Liberation Mono"',
          'monospace',
        ],
      },
      fontSize: {
        /* 阅读型字号阶：正文 17px，标题跨度大以拉开层级 */
        '2xs': ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.04em' }],
        xs: ['0.75rem', { lineHeight: '1.1rem', letterSpacing: '0.02em' }],
        sm: ['0.8125rem', { lineHeight: '1.4rem' }],
        base: ['1.0625rem', { lineHeight: '1.75' }],
        lg: ['1.1875rem', { lineHeight: '1.7' }],
        xl: ['1.375rem', { lineHeight: '1.55' }],
        '2xl': ['1.75rem', { lineHeight: '1.4' }],
        '3xl': ['2.125rem', { lineHeight: '1.25' }],
        '4xl': ['2.75rem', { lineHeight: '1.15' }],
        '5xl': ['3.5rem', { lineHeight: '1.05' }],
      },
      maxWidth: {
        /* 中文阅读舒适区：每行约 38–42 个汉字 */
        reading: '38rem',
        wide: '64rem',
        page: '78rem',
      },
      letterSpacing: {
        tighter: '-0.02em',
      },
      borderRadius: {
        /* 只有两档：几乎方正的容器，避免圆角带来的"软化"感 */
        none: '0',
        sm: '2px',
        DEFAULT: '3px',
      },
      keyframes: {
        'rise': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        rise: 'rise 260ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
}

export default config
