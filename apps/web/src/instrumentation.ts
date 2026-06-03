/**
 * Next.js instrumentation — runs once at server startup before any route handler.
 * Sets PRISMA_QUERY_ENGINE_LIBRARY so PrismaClient can find the engine binary
 * in the Vercel monorepo deployment layout (/var/task/packages/db/generated/).
 *
 * Uses webpackIgnore to prevent bundler from trying to resolve path/fs as npm modules.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;
  if (process.env.PRISMA_QUERY_ENGINE_LIBRARY) return;

  // Vercel deploys the monorepo under /var/task — the engine is always at this path.
  // Setting it here before any route handler runs ensures PrismaClient finds the engine.
  const vercelPath =
    '/var/task/packages/db/generated/libquery_engine-rhel-openssl-3.0.x.so.node';

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require(/* webpackIgnore: true */ 'fs') as typeof import('fs');
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require(/* webpackIgnore: true */ 'path') as typeof import('path');

    const candidates = [
      vercelPath,
      path.join(process.cwd(), '../../packages/db/generated/libquery_engine-rhel-openssl-3.0.x.so.node'),
      path.join(process.cwd(), '../../packages/db/generated/libquery_engine-rhel-openssl-1.1.x.so.node'),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        process.env.PRISMA_QUERY_ENGINE_LIBRARY = p;
        return;
      }
    }
  } catch {
    // fs/path unavailable — fall back to known Vercel path unconditionally
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = vercelPath;
  }
}
