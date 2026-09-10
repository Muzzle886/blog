/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // jsdom / highlight.js 仅在服务端使用，避免被打进 client bundle
    serverComponentsExternalPackages: ['jsdom', 'dompurify', 'highlight.js'],
  },
}

export default nextConfig
