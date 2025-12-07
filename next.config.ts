import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
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
