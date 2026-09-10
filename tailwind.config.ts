import type { Config } from 'tailwindcss'

/**
 * 极简扁平设计系统
 * - 中性色为主，单一强调色（accent）
 * - 无阴影/小圆角，靠 1px 边框与留白建立层级
 * - darkMode: class，由 ThemeProvider 写入 <html class="dark">
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
        ink: {
          50: '#f7f8f8',
          100: '#eeeff0',
          200: '#dfe1e3',
          300: '#c7cacd',
          400: '#9ba0a5',
          500: '#71767c',
          600: '#54595f',
          700: '#3f434a',
          800: '#2a2d31',
          900: '#1a1c1f',
          950: '#111214',
        },
        accent: {
          DEFAULT: '#2563eb',
          soft: '#eff4ff',
          strong: '#1d4ed8',
        },
      },
      fontFamily: {
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
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      maxWidth: {
        prose: '68ch',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        'fade-in': 'fade-in 220ms ease-out both',
      },
    },
  },
  plugins: [],
}

export default config
