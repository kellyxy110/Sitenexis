import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Set monorepo root as the tracing root so packages/db/ is reachable.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Include the Prisma engine binary. We include both path variants because
  // Next.js 15 evaluates these globs relative to the project dir (apps/web/)
  // in some versions and relative to outputFileTracingRoot in others.
  outputFileTracingIncludes: {
    '**': [
      // Relative to outputFileTracingRoot (monorepo root)
      'packages/db/generated/**',
      // Relative to apps/web/ (Next.js project dir)
      '../../packages/db/generated/**',
    ],
  },

  transpilePackages: ['@sitenexis/shared'],
  serverExternalPackages: [
    '@prisma/client', 'pino', 'pino-pretty',
    '@sitenexis/db', '@sitenexis/crawler', '@sitenexis/agents', '@sitenexis/analyzers',
    '@react-pdf/renderer', '@aws-sdk/client-s3', 'puppeteer', 'bullmq', 'ioredis',
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },

  webpack(config, { isServer }) {
    if (isServer) {
      // Prevent webpack from bundling worker-only packages that are
      // never needed in the Next.js server runtime.
      const workerOnlyExternals = [
        '@react-pdf/renderer',
        '@aws-sdk/client-s3',
        '@aws-sdk/client-s3-multipart-upload',
        'puppeteer',
        'puppeteer-core',
        'bullmq',
        'ioredis',
        'lighthouse',
      ];
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals]),
        ...workerOnlyExternals,
      ];
    }
    return config;
  },
};

export default nextConfig;
