export const dynamic = 'force-dynamic';
import { after } from 'next/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';
import {
  createDemoAudit,
  updateDemoAudit,
  buildDemoResults,
} from '@/lib/demo-store';

const StartAuditSchema = z.object({
  domain: z.string().min(1).max(253),
});

// ── Diagnostic stage tracker ──────────────────────────────────────────────────

interface StageResult {
  stage: string;
  status: 'ok' | 'error' | 'skipped';
  error?: string;
  recommended_fix?: string;
}

function stageError(stage: string, err: unknown, recommended_fix: string): StageResult {
  const error = err instanceof Error ? err.message : String(err);
  return { stage, status: 'error', error: error.slice(0, 500), recommended_fix };
}

// ── Main route ────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = StartAuditSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { domain } = parsed.data;

  // ── Demo mode ────────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    return startDemoAudit(domain);
  }

  // ── Real mode ─────────────────────────────────────────────────────────────────
  const stages: StageResult[] = [];

  // Stage 1: User upsert — proves DB is reachable and schema exists
  try {
    const { upsertUser } = await import('@sitenexis/db');
    await upsertUser(user.id, user.email);
    stages.push({ stage: 'db_upsert_user', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'db_upsert_user',
      err,
      'Check DATABASE_URL on Vercel. Run pnpm db:push to ensure tables exist. Verify Prisma engine binary is deployed.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain }, 'Audit start failed');
    return dbUnavailable(stages);
  }

  // Stage 2: Credit check + deduction
  // Determine action type: Layer 4 costs 5 credits, standard costs 2 credits.
  // We do a preliminary layer4 check here just to pick the cost; the gating check happens in Stage 3.
  let prelimLayer4 = false;
  try {
    const { checkLayer4Access } = await import('@/lib/plans');
    prelimLayer4 = await checkLayer4Access(user.id);
  } catch { /* non-fatal — use conservative cost */ }

  const auditAction = prelimLayer4 ? 'ai_swarm_audit' : 'ai_visibility_audit';

  let creditResult: { allowed: boolean; reason?: string };
  try {
    const { checkAndDeductCredits } = await import('@/lib/credits');
    creditResult = await checkAndDeductCredits(user.id, auditAction, { domain });
    stages.push({ stage: 'check_credits', status: 'ok' });
  } catch (err) {
    const s = stageError('check_credits', err, 'Credit check failed. Database query failed on users table.');
    stages.push(s);
    logger.error({ err, stage: s.stage, domain }, 'Audit start failed');
    return dbUnavailable(stages);
  }

  if (!creditResult.allowed) {
    return NextResponse.json({ error: creditResult.reason }, { status: 402 });
  }

  // Stage 3: Layer 4 access check (plan-based OR unlimited flag)
  let layer4Enabled = false;
  try {
    const { checkLayer4Access } = await import('@/lib/plans');
    const { getUserCredits } = await import('@sitenexis/db');
    const [planAccess, credits] = await Promise.all([
      checkLayer4Access(user.id),
      getUserCredits(user.id),
    ]);
    layer4Enabled = planAccess || credits.isUnlimited;
    stages.push({ stage: 'check_layer4_access', status: 'ok' });
  } catch (err) {
    const s = stageError('check_layer4_access', err, 'Database query failed on users/plans table.');
    stages.push(s);
    logger.error({ err, stage: s.stage, domain }, 'Audit start failed');
    return dbUnavailable(stages);
  }

  // Stage 4: Create audit record
  let audit: { id: string };
  try {
    const { createAudit } = await import('@sitenexis/db');
    audit = await createAudit(user.id, domain);
    stages.push({ stage: 'db_create_audit', status: 'ok' });
  } catch (err) {
    const s = stageError('db_create_audit', err, 'Cannot write to audits table. Check DATABASE_URL and run pnpm db:push.');
    stages.push(s);
    logger.error({ err, stage: s.stage, domain }, 'Audit start failed');
    return dbUnavailable(stages);
  }

  // Stage 5: Try BullMQ / Redis — fall back to serverless execution if unavailable
  let executionMode: 'bullmq' | 'serverless' = 'serverless';

  try {
    const { enqueueCrawlJob } = await import('@sitenexis/crawler');
    await enqueueCrawlJob({ auditId: audit.id, domain, userId: user.id, layer4Enabled });
    executionMode = 'bullmq';
    stages.push({ stage: 'enqueue_crawl_job', status: 'ok' });
  } catch {
    // Redis unavailable — use serverless audit instead of returning 503
    stages.push({
      stage: 'enqueue_crawl_job',
      status: 'skipped',
      error: 'Redis unavailable. Falling back to serverless audit execution.',
      recommended_fix: 'Set REDIS_URL on Vercel to an Upstash Redis URL for full pipeline support.',
    });

    // Schedule serverless audit to run after this response is sent
    after(async () => {
      try {
        const { runServerlessAudit } = await import('@/lib/serverless-audit');
        await runServerlessAudit(audit.id, domain, user.id);
      } catch (auditErr) {
        logger.error({ auditId: audit.id, domain, err: auditErr }, 'Serverless audit after() failed');
        try {
          const { updateAuditStatus } = await import('@sitenexis/db');
          await updateAuditStatus(audit.id, 'failed', {
            errorMessage: auditErr instanceof Error ? auditErr.message : 'Serverless audit failed',
          });
        } catch { /* best effort */ }
      }
    });
  }

  // Stage 6: Worker heartbeat check (informational only — non-fatal)
  if (executionMode === 'bullmq') {
    try {
      const { getRedisConnection, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } = await import('@sitenexis/crawler');
      const heartbeatRaw = await getRedisConnection().get(HEARTBEAT_KEY);
      const workerAlive = heartbeatRaw ? Date.now() - parseInt(heartbeatRaw, 10) < HEARTBEAT_STALE_MS : false;
      stages.push({
        stage: 'worker_heartbeat',
        status: workerAlive ? 'ok' : 'error',
        ...(!workerAlive && {
          error: 'No worker heartbeat detected.',
          recommended_fix: 'The audit is queued but no worker is running to process it. Start the BullMQ worker: pnpm --filter @sitenexis/crawler dev:worker. On Vercel, ensure REDIS_URL is set and the worker runs separately (Railway, Fly.io, or a VPS).',
        }),
      });
    } catch {
      stages.push({ stage: 'worker_heartbeat', status: 'skipped' });
    }
  }

  const workerAlive = stages.find((s) => s.stage === 'worker_heartbeat')?.status === 'ok';

  logger.info({
    auditId: audit.id,
    domain,
    userId: user.id,
    layer4Enabled,
    executionMode,
    workerAlive,
  }, 'Audit started');

  return NextResponse.json(
    { auditId: audit.id, executionMode, workerAlive },
    { status: 202 },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Only DB failures return 503 — Redis failures use serverless fallback instead */
function dbUnavailable(stages: StageResult[]): NextResponse {
  const failed = stages.find((s) => s.status === 'error');
  return NextResponse.json(
    {
      error: `Database unavailable: ${failed?.error ?? 'unknown error'}`,
      failed_stage: failed?.stage ?? 'unknown',
      recommended_fix: failed?.recommended_fix ?? 'Check DATABASE_URL and Prisma engine configuration.',
      diagnosis: stages,
    },
    { status: 503 },
  );
}

function startDemoAudit(domain: string): NextResponse {
  const audit = createDemoAudit(domain);
  void runDemoSimulation(audit.id, domain);
  logger.info({ auditId: audit.id, domain, mode: 'demo' }, 'Demo audit started');
  return NextResponse.json({ auditId: audit.id, executionMode: 'demo' }, { status: 202 });
}

// ── Demo simulation ───────────────────────────────────────────────────────────

async function runDemoSimulation(auditId: string, domain: string): Promise<void> {
  const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

  updateDemoAudit(auditId, { status: 'running' });
  await delay(1200);

  for (let i = 1; i <= 8; i++) {
    updateDemoAudit(auditId, { pageCount: i });
    await delay(400);
  }

  await delay(800);
  const results = buildDemoResults(domain);
  updateDemoAudit(auditId, { ...results, status: 'complete' });
}
