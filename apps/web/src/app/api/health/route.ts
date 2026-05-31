export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readdirSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────────────────────

interface DiagnosticStage {
  stage: string;
  status: 'ok' | 'error' | 'skipped';
  latency_ms?: number;
  error?: string;
  detail?: unknown;
  recommended_fix?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scanForEngines(dirs: string[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const dir of dirs) {
    try {
      const files = readdirSync(dir).filter(
        (f) => f.includes('libquery_engine') || f.endsWith('.so.node'),
      );
      result[dir] = files.length > 0 ? files : ['<empty>'];
    } catch {
      result[dir] = ['<not found>'];
    }
  }
  return result;
}

async function withTiming<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; ms: number }> {
  const t = Date.now();
  const result = await fn();
  return { result, ms: Date.now() - t };
}

// ── Stage checks ──────────────────────────────────────────────────────────────

/** Stage 1: Environment variable presence — uses getConfigurationStatus for consistency */
function checkEnvVars(): DiagnosticStage {
  const { getConfigurationStatus } = require('@/lib/mode') as typeof import('@/lib/mode');
  const { fullyConfigured, services } = getConfigurationStatus();

  const gaps = Object.entries(services)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => `${k}: ${v.reason}`);

  const detail = {
    DATABASE_URL: (process.env['DATABASE_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
    SUPABASE_URL: (process.env['SUPABASE_URL'] ?? '').slice(0, 60),
    REDIS_URL: (process.env['REDIS_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
    ANTHROPIC_API_KEY: process.env['ANTHROPIC_API_KEY'] ? 'set' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_URL: process.env['NEXT_PUBLIC_SUPABASE_URL'] ? 'set' : 'MISSING',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ? 'set' : 'MISSING',
    serviceStatus: services,
  };

  if (!fullyConfigured) {
    return {
      stage: 'env_vars',
      status: 'error',
      error: gaps.join(' | '),
      detail,
      recommended_fix:
        'Set all required env vars on Vercel: DATABASE_URL (pooler, port 6543, ?pgbouncer=true), SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, REDIS_URL (Upstash rediss:// URL). Redeploy after adding.',
    };
  }

  return { stage: 'env_vars', status: 'ok', detail };
}

/** Stage 2: Prisma engine binary location */
function checkPrismaEngine(): DiagnosticStage {
  const cwd = process.cwd();
  const scanDirs = [
    join(cwd, 'packages', 'db', 'generated'),
    join(cwd, '..', 'packages', 'db', 'generated'),
    join(cwd, '..', '..', 'packages', 'db', 'generated'),
    '/var/task/packages/db/generated',
    '/var/task/apps/web/packages/db/generated',
    '/vercel/path0/packages/db/generated',
  ];

  const engineEnvVar = process.env['PRISMA_QUERY_ENGINE_LIBRARY'] ?? null;
  const engineScan = scanForEngines(scanDirs);

  const found = engineEnvVar
    ? true
    : Object.values(engineScan).some((files) => files.some((f) => f !== '<not found>' && f !== '<empty>'));

  return {
    stage: 'prisma_engine',
    status: found ? 'ok' : 'error',
    detail: { cwd, engineEnvVar, engineScan },
    ...(found
      ? {}
      : {
          error: 'Prisma engine binary not found in expected paths',
          recommended_fix:
            'Ensure outputFileTracingRoot in next.config.ts points to monorepo root, and outputFileTracingIncludes contains packages/db/generated/**. Verify the binary is committed or generated during build.',
        }),
  };
}

/** Stage 3: Database connectivity (SELECT 1) */
async function checkDatabase(): Promise<DiagnosticStage> {
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

/** Stage 4: Database schema (query the users table) */
async function checkDatabaseSchema(): Promise<DiagnosticStage> {
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

/** Stage 5: Redis ping — uses crawler's createRedisClient with hard 5s timeout */
async function checkRedis(): Promise<DiagnosticStage> {
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

/** Stage 6: BullMQ queue creation */
async function checkBullMQQueue(): Promise<DiagnosticStage> {
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

/** Stage 7: Worker heartbeat (is a worker process running?) */
async function checkWorkerHeartbeat(): Promise<DiagnosticStage> {
  const { result, ms } = await withTiming(async () => {
    const { getRedisConnection, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } =
      await import('@sitenexis/crawler');
    const raw = await getRedisConnection().get(HEARTBEAT_KEY);
    if (!raw) return { ok: false, reason: 'No heartbeat key in Redis — worker never started or not running' };
    const age = Date.now() - parseInt(raw, 10);
    const alive = age < HEARTBEAT_STALE_MS;
    return { ok: alive, ageMs: age, staleThresholdMs: HEARTBEAT_STALE_MS };
  }).catch((err) => ({
    result: { ok: false, reason: err instanceof Error ? err.message : String(err) },
    ms: 0,
  }));

  const r = result as { ok: boolean; reason?: string; ageMs?: number; staleThresholdMs?: number };

  return {
    stage: 'worker_heartbeat',
    status: r.ok ? 'ok' : 'error',
    latency_ms: ms,
    detail: r,
    ...(r.ok
      ? {}
      : {
          error: r.reason ?? 'Worker heartbeat stale or missing',
          recommended_fix:
            'The BullMQ worker process is not running. Jobs are being queued but never processed. Start the worker: pnpm --filter @sitenexis/crawler dev:worker. On Vercel production, the worker must run as a separate long-lived process (Railway, Fly.io, or a VPS).',
        }),
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // Env vars and Prisma engine are synchronous — run first
  const envCheck = checkEnvVars();
  const engineCheck = checkPrismaEngine();

  // DB, Redis, BullMQ, and worker run in parallel
  const [dbConn, dbSchema, redis, bullmq, worker] = await Promise.all([
    checkDatabase(),
    checkDatabaseSchema(),
    checkRedis(),
    checkBullMQQueue(),
    checkWorkerHeartbeat(),
  ]);

  const stages: DiagnosticStage[] = [
    envCheck,
    engineCheck,
    dbConn,
    dbSchema,
    redis,
    bullmq,
    worker,
  ];

  const errors = stages.filter((s) => s.status === 'error');
  const allOk = errors.length === 0;

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      summary: allOk
        ? 'All systems operational'
        : `${errors.length} check(s) failed: ${errors.map((e) => e.stage).join(', ')}`,
      stages,
    },
    { status: allOk ? 200 : 503 },
  );
}
