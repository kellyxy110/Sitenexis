import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient | undefined };

function buildDatabaseUrl(): string {
  const url = process.env['DATABASE_URL'] ?? '';
  // Supabase transaction pooler (port 6543) uses PgBouncer which does not
  // support prepared statements. Append pgbouncer=true to disable them.
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
