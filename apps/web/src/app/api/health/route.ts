export const dynamic = 'force-dynamic';
import { readdirSync } from 'fs';
import { join } from 'path';
import { NextResponse } from 'next/server';

function scanForEngines(dirs: string[]): Record<string, string[]> {
  const results: Record<string, string[]> = {};
  for (const dir of dirs) {
    try {
      const files = readdirSync(dir).filter(f => f.includes('libquery_engine') || f.endsWith('.so.node'));
      results[dir] = files.length > 0 ? files : ['<empty>'];
    } catch {
      results[dir] = ['<not found>'];
    }
  }
  return results;
}

async function checkDatabase(): Promise<{ ok: boolean; error?: string; debug?: unknown }> {
  try {
    const { prisma } = await import('@sitenexis/db');
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);

    const cwd = process.cwd();
    // Scan the directories most likely to contain the Prisma engine binary
    const scanDirs = [
      join(cwd, 'packages', 'db', 'generated'),
      join(cwd, '..', 'packages', 'db', 'generated'),
      join(cwd, '..', '..', 'packages', 'db', 'generated'),
      '/var/task/packages/db/generated',
      '/var/task/apps/web/packages/db/generated',
    ];

    // Also scan node_modules for @sitenexis/db to find where it resolves
    let dbModulePath = 'unknown';
    try {
      dbModulePath = require.resolve('@sitenexis/db');
    } catch { /* ok */ }

    return {
      ok: false,
      error: msg.slice(0, 300),
      debug: {
        cwd,
        dirname: __dirname,
        engineEnvVar: process.env['PRISMA_QUERY_ENGINE_LIBRARY'] ?? null,
        dbModulePath,
        engineScan: scanForEngines(scanDirs),
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
