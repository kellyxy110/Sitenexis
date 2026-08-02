export const dynamic = 'force-dynamic';
import { NextResponse } from 'next/server';
import { readdirSync } from 'fs';
import { join } from 'path';
import { getConfigurationStatus } from '@/lib/mode';
import {
  type DiagnosticStage,
  checkWorkerHeartbeat,
  checkDatabase,
  checkDatabaseSchema,
  checkRedis,
  checkBullMQQueue,
} from '@/lib/health-checks';

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

// ── Stage checks ──────────────────────────────────────────────────────────────

/** Stage 1: Environment variable presence — uses getConfigurationStatus for consistency */
function checkEnvVars(): DiagnosticStage {
  const { fullyConfigured, services } = getConfigurationStatus();

  const gaps = Object.entries(services)
    .filter(([, v]) => !v.ok)
    .map(([k, v]) => `${k}: ${v.reason}`);

  const detail = {
    DATABASE_URL: (process.env['DATABASE_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
    SUPABASE_URL: (process.env['SUPABASE_URL'] ?? '').slice(0, 60),
    REDIS_URL: (process.env['REDIS_URL'] ?? '').replace(/:[^@]+@/, ':***@').slice(0, 80),
    GROQ_API_KEY: process.env['GROQ_API_KEY'] ? 'set' : 'MISSING',
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

// Stages 3-6 (db connectivity, db schema, redis ping, bullmq queue) live in
// @/lib/health-checks — shared with the Telegram ops /status command so both
// surfaces report identical results from one implementation.

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
  const notConfigured = stages.filter((s) => s.status === 'not_configured');
  const allOk = errors.length === 0;

  return NextResponse.json(
    {
      status: allOk ? 'ok' : 'degraded',
      summary: allOk
        ? notConfigured.length > 0
          ? `All systems operational (${notConfigured.map((s) => s.stage).join(', ')} not configured — expected on this deployment)`
          : 'All systems operational'
        : `${errors.length} check(s) failed: ${errors.map((e) => e.stage).join(', ')}`,
      stages,
    },
    { status: allOk ? 200 : 503 },
  );
}
