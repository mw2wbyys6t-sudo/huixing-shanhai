/** @type {import('next').NextConfig} */
// 部署 basePath：本地开发可通过环境变量覆盖（设为空字符串则无前缀）
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? '/app/app_17dfqqgrsds';

const nextConfig = {
  reactStrictMode: true,
  output: 'export',
  basePath,
  // 注入给客户端代码（如 ClayIcon 的静态资源前缀）
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'commons.wikimedia.org',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
      },
    ],
  },
};

module.exports = nextConfig;
