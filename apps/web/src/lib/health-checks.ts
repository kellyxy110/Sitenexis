/**
 * Shared types and stage-check helpers for /api/health, split out of route.ts
 * because Next.js App Router route files may only export HTTP handlers and a
 * small fixed set of config values — no other export is type-checkable, which
 * also means these checks can't be unit tested directly from route.ts.
 */

export interface DiagnosticStage {
  stage: string;
  status: 'ok' | 'error' | 'skipped' | 'not_configured';
  latency_ms?: number;
  error?: string;
  detail?: unknown;
  recommended_fix?: string;
}

export async function withTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const t = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t };
}

/** Database connectivity (SELECT 1) */
export async function checkDatabase(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { prisma } = await import('@sitenexis/db');
    await prisma.$queryRaw`SELECT 1`;
    return { ok: true };
  }).catch((err) => ({
    result: { ok: false, error: err instanceof Error ? err.message : String(err) },
    ms: 0,
  }));

  if (!result.ok) {
    const msg = (result as { ok: false; error: string }).error;
    return {
      stage: 'db_connectivity',
      status: 'error',
      latency_ms: ms,
      error: msg.slice(0, 400),
      recommended_fix:
        'Check DATABASE_URL on Vercel. Use the pooler URL at port 6543 with ?pgbouncer=true. Ensure the Supabase project is not paused.',
    };
  }

  return { stage: 'db_connectivity', status: 'ok', latency_ms: ms };
}

/** Database schema (query the users table) */
export async function checkDatabaseSchema(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { prisma } = await import('@sitenexis/db');
    await prisma.$queryRaw`SELECT COUNT(*) FROM users LIMIT 1`;
    return { ok: true };
  }).catch((err) => ({
    result: { ok: false, error: err instanceof Error ? err.message : String(err) },
    ms: 0,
  }));

  if (!result.ok) {
    const msg = (result as { ok: false; error: string }).error;
    return {
      stage: 'db_schema',
      status: 'error',
      latency_ms: ms,
      error: msg.slice(0, 400),
      recommended_fix:
        'Run pnpm db:push to push the Prisma schema to Supabase. Tables do not exist yet.',
    };
  }

  return { stage: 'db_schema', status: 'ok', latency_ms: ms };
}

/** Redis ping — uses crawler's createRedisClient with hard 5s timeout */
export async function checkRedis(): Promise<DiagnosticStage> {
  const rawUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';
  const safeUrl = rawUrl.replace(/:[^@]+@/, ':***@');

  const { result, ms } = await withTiming(async () => {
    const { createRedisClient } = await import('@sitenexis/crawler');
    const client = createRedisClient();
    try {
      const pong = await Promise.race([
        client.ping(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Redis ping timed out after 5s')), 5_000),
        ),
      ]);
      return { ok: pong === 'PONG', pong };
    } finally {
      client.disconnect();
    }
  }).catch((err) => ({
    result: { ok: false, error: err instanceof Error ? err.message : String(err) },
    ms: 0,
  }));

  if (!result.ok) {
    const msg = (result as { ok: false; error: string }).error;
    return {
      stage: 'redis_ping',
      status: 'error',
      latency_ms: ms,
      error: msg.slice(0, 400),
      detail: { redisUrl: safeUrl },
      recommended_fix:
        'REDIS_URL is unreachable. On Vercel, set REDIS_URL to an Upstash Redis URL (rediss://...). Get one free at upstash.com. The audit pipeline cannot enqueue jobs without Redis.',
    };
  }

  return { stage: 'redis_ping', status: 'ok', latency_ms: ms, detail: { redisUrl: safeUrl } };
}

/** BullMQ queue creation */
export async function checkBullMQQueue(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { getCrawlQueueStats } = await import('@sitenexis/crawler');
    const stats = await getCrawlQueueStats();
    return { ok: true, stats };
  }).catch((err) => ({
    result: { ok: false, error: err instanceof Error ? err.message : String(err) },
    ms: 0,
  }));

  if (!result.ok) {
    const msg = (result as { ok: false; error: string }).error;
    return {
      stage: 'bullmq_queue',
      status: 'error',
      latency_ms: ms,
      error: msg.slice(0, 400),
      recommended_fix: 'BullMQ queue creation failed. Redis must be reachable first.',
    };
  }

  return {
    stage: 'bullmq_queue',
    status: 'ok',
    latency_ms: ms,
    detail: (result as { ok: true; stats: unknown }).stats,
  };
}

/**
 * Stage 7: Worker heartbeat (is a BullMQ worker process running?)
 *
 * SiteNexis's production audit path runs entirely through the serverless runner
 * (runServerlessAudit) — no BullMQ worker is deployed. A never-written heartbeat
 * key is therefore the *expected* steady state, not a fault, and must not flip
 * the overall health response to 503. A STALE heartbeat is different: it means a
 * worker WAS running recently and has since gone dark — that is a real
 * regression and still reports as an error.
 */
export async function checkWorkerHeartbeat(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { getRedisConnection, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } =
      await import('@sitenexis/crawler');
    const raw = await getRedisConnection().get(HEARTBEAT_KEY);
    if (!raw) return { status: 'not_configured' as const, reason: 'No heartbeat key in Redis — no BullMQ worker has ever run. Expected when the serverless audit path is the only runner.' };
    const age = Date.now() - parseInt(raw, 10);
    const alive = age < HEARTBEAT_STALE_MS;
    return {
      status: alive ? 'ok' as const : 'error' as const,
      ageMs: age,
      staleThresholdMs: HEARTBEAT_STALE_MS,
      ...(alive ? {} : { reason: 'Heartbeat key exists but is stale — a worker was running recently and has stopped updating it' }),
    };
  }).catch((err) => ({
    result: {
      status: 'error' as const,
      reason: err instanceof Error ? err.message : String(err),
    },
    ms: 0,
  }));

  const r = result as { status: 'ok' | 'error' | 'not_configured'; reason?: string; ageMs?: number; staleThresholdMs?: number };

  return {
    stage: 'worker_heartbeat',
    status: r.status,
    latency_ms: ms,
    detail: r,
    ...(r.status === 'ok'
      ? {}
      : r.status === 'not_configured'
        ? {
            recommended_fix:
              'No worker detected — this is expected on the serverless-only deployment. If you intend to run the BullMQ worker (bulk/background processing), start it: pnpm --filter @sitenexis/crawler dev:worker. Otherwise no action is needed.',
          }
        : {
            error: r.reason ?? 'Worker heartbeat check failed',
            recommended_fix:
              'Could not read the worker heartbeat from Redis. If Redis itself is unreachable, see the redis_ping stage. If Redis is reachable but this still errors, a BullMQ worker may have crashed after previously running — check the worker process (Railway, Fly.io, or a VPS).',
          }),
  };
}
