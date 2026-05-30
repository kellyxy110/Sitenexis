import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Monorepo root so file tracing can reach packages/ and the pnpm store.
  outputFileTracingRoot: path.join(__dirname, '../../'),

  // Include the Prisma generated client (binary + JS) from its custom output
  // location. The generated client knows its own binary path relative to itself,
  // so this is the only approach that works reliably in a pnpm monorepo on Vercel.
  outputFileTracingIncludes: {
    '**': ['packages/db/generated/**'],
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
