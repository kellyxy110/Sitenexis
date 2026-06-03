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
    '@sitenexis/db', '@sitenexis/crawler', '@sitenexis/agents', '@sitenexis/analyzers',
    '@react-pdf/renderer', '@aws-sdk/client-s3', 'puppeteer', 'bullmq', 'ioredis',
    'lighthouse', 'puppeteer-core', '@aws-sdk/client-s3-multipart-upload',
  ],

  webpack(config, { isServer }) {
    if (isServer) {
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        '@react-pdf/renderer', '@aws-sdk/client-s3', '@aws-sdk/client-s3-multipart-upload',
        'puppeteer', 'puppeteer-core', 'bullmq', 'ioredis', 'lighthouse',
      ];
    }
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
