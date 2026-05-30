export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';

async function checkDatabase(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { prisma } = await import('@sitenexis/db');
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 300) };
  }
}

async function checkRedis(): Promise<{ ok: boolean; error?: string }> {
  try {
    const { getRedisConnection } = await import('@sitenexis/crawler');
    const redis = getRedisConnection();
    const pong = await redis.ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg.slice(0, 300) };
  }
}

export async function GET(): Promise<NextResponse> {
  const [db, redis] = await Promise.all([checkDatabase(), checkRedis()]);

  const checks = {
    db: db.ok,
    dbError: db.error,
    redis: redis.ok,
    redisError: redis.error,
    redisUrl: (process.env['REDIS_URL'] ?? '').replace(/:[^@]+@/, ':***@'),
    databaseUrl: (process.env['DATABASE_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
  };

  const allHealthy = db.ok && redis.ok;

  return NextResponse.json(
    { status: allHealthy ? 'ok' : 'degraded', checks },
    { status: allHealthy ? 200 : 503 },
  );
}
