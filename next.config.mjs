/** @type {import('next').NextConfig} */
const nextConfig = {
  // standalone：产出自包含的服务端目录（含被追踪到的依赖），
  // 容器里不需要整包 node_modules。Dockerfile 依赖这个输出。
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // jsdom / highlight.js 仅在服务端使用，避免被打进 client bundle
    serverComponentsExternalPackages: ['jsdom', 'dompurify', 'highlight.js'],
  },
}

export default nextConfig
