import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname, '../../'),

  outputFileTracingIncludes: {
    '**': [
      'packages/db/generated/**',
      '../../packages/db/generated/**',
    ],
  },

  transpilePackages: ['@sitenexis/shared'],
  serverExternalPackages: [
    '@prisma/client', 'pino', 'pino-pretty',
    '@sitenexis/db', '@sitenexis/analyzers',
    'bullmq', 'ioredis',
  ],

  webpack(config) {
    config.resolve = {
      ...config.resolve,
      fallback: {
        ...((config.resolve as { fallback?: Record<string, boolean> }).fallback ?? {}),
        fs: false,
        path: false,
      },
    };
    return config;
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
