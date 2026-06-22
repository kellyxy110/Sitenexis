import { join, dirname } from 'path';
import { existsSync } from 'fs';
import { PrismaClient } from '../generated';

/**
 * Walk up the directory tree from `start`, looking for a `packages/db/generated` subtree.
 * Returns the full path to that directory, or null if not found within `maxLevels` steps.
 *
 * Handles both the local monorepo layout and Vercel's /var/task layout where:
 *   - Local dev: __dirname might be packages/db/dist/
 *   - Vercel build: __dirname is a deep .next/server/chunks path
 *   - Vercel runtime: files land at /var/task/packages/db/generated
 */
function findEngineDirByWalking(start: string, maxLevels = 12): string | null {
  let dir = start;
  for (let i = 0; i < maxLevels; i++) {
    const candidate = join(dir, 'packages', 'db', 'generated');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break; // filesystem root
    dir = parent;
  }
  return null;
}

function setEngineLibrary(): void {
  if (process.env['PRISMA_QUERY_ENGINE_LIBRARY']) return;

  const candidates: string[] = [
    // ── Monorepo root walk (most reliable) ─────────────────────────────────────
    // Walk up from __dirname until we find packages/db/generated
    ...((): string[] => {
      const found = findEngineDirByWalking(__dirname);
      return found ? [found] : [];
    })(),
    // Walk up from CWD (covers Vercel build where CWD = apps/web)
    ...((): string[] => {
      const found = findEngineDirByWalking(process.cwd());
      return found ? [found] : [];
    })(),

    // ── Direct relative paths (fast path for worker process) ────────────────────
    join(__dirname, '..', 'generated'),             // packages/db/dist → packages/db/generated
    join(__dirname, '..', '..', 'generated'),

    // ── Vercel serverless runtime (/var/task is the function root) ──────────────
    '/var/task/packages/db/generated',

    // ── Vercel build time (/vercel/path0 is the build root) ────────────────────
    '/vercel/path0/packages/db/generated',

    // ── CWD-relative fallbacks ──────────────────────────────────────────────────
    join(process.cwd(), 'packages', 'db', 'generated'),
    join(process.cwd(), '..', 'packages', 'db', 'generated'),
    join(process.cwd(), '..', '..', 'packages', 'db', 'generated'),
  ];

  const engines = [
    'query_engine-windows.dll.node',
    'libquery_engine-rhel-openssl-3.0.x.so.node',
    'libquery_engine-rhel-openssl-1.1.x.so.node',
    'libquery_engine-linux-musl-openssl-3.0.x.so.node',
    'libquery_engine-linux-musl.so.node',
  ];

  for (const dir of candidates) {
    if (!dir) continue;
    for (const engine of engines) {
      const p = join(dir, engine);
      if (existsSync(p)) {
        process.env['PRISMA_QUERY_ENGINE_LIBRARY'] = p;
        return;
      }
    }
  }
}

setEngineLibrary();

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function buildDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'] ?? '';
  if (url.includes(':6543/') && !url.includes('pgbouncer=true')) {
    const sep = url.includes('?') ? '&' : '?';
    return `${url}${sep}pgbouncer=true`;
  }
  return url;
}

const prismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: { db: { url: buildDatabaseUrl() } },
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prismaClient;
}

export const db = prismaClient;
export const prisma = prismaClient;
