export const dynamic = 'force-dynamic';
import { readdirSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

async function checkDatabase(): Promise<{ ok: boolean; error?: string; debug?: unknown }> {
  try {
    const { prisma } = await import('@sitenexis/db');
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    // Diagnostic: find what engine binaries are actually present at runtime
    const cwd = process.cwd();
    const searchDirs = [
      join(cwd, 'packages', 'db', 'generated'),
      join(cwd, 'packages', 'db', 'dist', '..', 'generated'),
      join(__dirname, '..', '..', '..', '..', 'packages', 'db', 'generated'),
    ];
    const found: Record<string, string[]> = {};
    for (const dir of searchDirs) {
      try {
        const files = readdirSync(dir).filter(f => f.endsWith('.node') || f.endsWith('.js'));
        found[dir] = files;
      } catch {
        found[dir] = ['<not found>'];
      }
    }

    return {
      ok: false,
      error: msg.slice(0, 300),
      debug: {
        cwd,
        dirname: __dirname,
        engineEnvVar: process.env['PRISMA_QUERY_ENGINE_LIBRARY'] ?? null,
        searchResults: found,
      },
    };
  }
}

async function checkRedis(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { redisConnection } = await import('@sitenexis/crawler');
    const pong = await redisConnection.ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 300) };
  }
}

export async function GET(): Promise<NextResponse> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const allHealthy = db.ok && redis.ok;

  return NextResponse.json(
    {
      status: allHealthy ? 'ok' : 'degraded',
      checks: {
        db: db.ok,
        dbError: db.error,
        dbDebug: db.debug,
        redis: redis.ok,
        redisError: redis.error,
        redisUrl: (process.env['REDIS_URL'] ?? '').replace(/:[^@]+@/, ':***@'),
        databaseUrl: (process.env['DATABASE_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
      },
    },
    { status: allHealthy ? 200 : 503 },
  );
}
