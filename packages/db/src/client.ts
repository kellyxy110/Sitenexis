import { join } from 'path';
import { existsSync } from 'fs';
import { PrismaClient } from '../generated';

// Locate and register the Prisma engine binary before new PrismaClient() is
// called. Prisma reads PRISMA_QUERY_ENGINE_LIBRARY at constructor time, so
// this must run first. The binary is in packages/db/generated/ (custom output);
// __dirname here is packages/db/dist/ in the compiled output.
function setEngineLibrary(): void {
  if (process.env['PRISMA_QUERY_ENGINE_LIBRARY']) return;
  const candidates = [
    join(__dirname, '..', 'generated'),            // packages/db/dist → packages/db/generated
    join(__dirname, '..', '..', 'generated'),      // one level deeper fallback
    join(process.cwd(), 'packages', 'db', 'generated'), // absolute from CWD (Vercel)
  ];
  const engines = [
    'libquery_engine-rhel-openssl-3.0.x.so.node',
    'libquery_engine-rhel-openssl-1.1.x.so.node',
    'libquery_engine-linux-musl-openssl-3.0.x.so.node',
  ];
  for (const dir of candidates) {
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
