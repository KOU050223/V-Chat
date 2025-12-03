import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  eslint: {
    // ビルド時に ESLint エラーを無視（一時的な設定）
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'vroid-hub.pximg.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
