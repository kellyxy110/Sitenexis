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
    // Tell webpack fs/path are Node built-ins — suppress "module not found" warnings
    // from instrumentation.ts which runs server-only but is compiled for all runtimes.
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
