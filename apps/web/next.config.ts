import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@sitenexis/shared'],
  serverExternalPackages: [
    '@prisma/client', 'pino', 'pino-pretty',
    '@sitenexis/db', '@sitenexis/crawler', '@sitenexis/agents',
  ],
  experimental: {
    // Tell Next.js the monorepo root so file tracing can reach the pnpm
    // virtual store (nex_env/) that lives two levels above apps/web.
    outputFileTracingRoot: path.join(__dirname, '../../'),
    // Explicitly include Prisma engine binaries — file tracing doesn't
    // follow native .node files across the workspace automatically.
    outputFileTracingIncludes: {
      '**': [
        'nex_env/**/@prisma/client/**',
        'nex_env/**/@prisma/engines/**',
        'packages/db/dist/**',
      ],
    },
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '**.supabase.co' },
      { protocol: 'https', hostname: '**.r2.cloudflarestorage.com' },
    ],
  },
};

export default nextConfig;
