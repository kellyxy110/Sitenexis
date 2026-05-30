import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo root so file tracing can reach the pnpm virtual store (nex_env/).
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Explicitly include Prisma engine binaries across the pnpm workspace.
  outputFileTracingIncludes: {
    '**': [
      'nex_env/**/@prisma/client/**',
      'nex_env/**/@prisma/engines/**',
      'packages/db/dist/**',
    ],
  },

  transpilePackages: ['@sitenexis/shared'],
  serverExternalPackages: [
    '@prisma/client', 'pino', 'pino-pretty',
    '@sitenexis/db', '@sitenexis/crawler', '@sitenexis/agents',
  ],

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
