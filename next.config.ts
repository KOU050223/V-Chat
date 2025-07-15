import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
  },
  // Firebase初期化のためのクライアントサイドでの動的インポートを有効化
  experimental: {
    esmExternals: false,
  },
};

export default nextConfig;
