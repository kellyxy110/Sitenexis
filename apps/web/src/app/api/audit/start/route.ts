export const dynamic = 'force-dynamic';
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

function stageError(
  stage: string,
  err: unknown,
  recommended_fix: string,
): StageResult {
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

  // ── Real mode — per-step diagnostics ─────────────────────────────────────────
  const stages: StageResult[] = [];

  // Stage 1: User upsert (proves DB is reachable + schema exists)
  let upsertUserFn: ((id: string, email: string) => Promise<unknown>) | null = null;
  try {
    const mod = await import('@sitenexis/db');
    upsertUserFn = mod.upsertUser;
    await mod.upsertUser(user.id, user.email);
    stages.push({ stage: 'db_upsert_user', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'db_upsert_user',
      err,
      'Check DATABASE_URL on Vercel. Run pnpm db:push to ensure tables exist. Verify Prisma engine binary is deployed.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain }, 'Audit start failed at stage: db_upsert_user');
    return serviceUnavailable(stages);
  }
  void upsertUserFn; // suppress unused warning

  // Stage 2: Plan limit check (DB read)
  let limitCheck: { allowed: boolean; reason?: string };
  try {
    const { checkAuditLimit } = await import('@/lib/plans');
    limitCheck = await checkAuditLimit(user.id);
    stages.push({ stage: 'check_audit_limit', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'check_audit_limit',
      err,
      'Database query failed on users table. Ensure the users table exists and user row has a valid plan field.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain }, 'Audit start failed at stage: check_audit_limit');
    return serviceUnavailable(stages);
  }

  if (!limitCheck.allowed) {
    return NextResponse.json({ error: limitCheck.reason }, { status: 402 });
  }

  // Stage 3: Layer 4 access check (DB read)
  let layer4Enabled = false;
  try {
    const { checkLayer4Access } = await import('@/lib/plans');
    layer4Enabled = await checkLayer4Access(user.id);
    stages.push({ stage: 'check_layer4_access', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'check_layer4_access',
      err,
      'Database query failed on users/plans table.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain }, 'Audit start failed at stage: check_layer4_access');
    return serviceUnavailable(stages);
  }

  // Stage 4: Create audit record (DB write)
  let audit: { id: string };
  try {
    const { createAudit } = await import('@sitenexis/db');
    audit = await createAudit(user.id, domain);
    stages.push({ stage: 'db_create_audit', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'db_create_audit',
      err,
      'Cannot write to audits table. Check DATABASE_URL and that db:push has been run.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain }, 'Audit start failed at stage: db_create_audit');
    return serviceUnavailable(stages);
  }

  // Stage 5: Enqueue BullMQ job (Redis write)
  try {
    const { enqueueCrawlJob } = await import('@sitenexis/crawler');
    await enqueueCrawlJob({ auditId: audit.id, domain, userId: user.id, layer4Enabled });
    stages.push({ stage: 'enqueue_crawl_job', status: 'ok' });
  } catch (err) {
    const s = stageError(
      'enqueue_crawl_job',
      err,
      'Redis connection failed. Set REDIS_URL on Vercel to an Upstash or external Redis URL. Default redis://localhost:6379 does not work on serverless.',
    );
    stages.push(s);
    logger.error({ err, stage: s.stage, errMsg: s.error, domain, auditId: audit.id }, 'Audit start failed at stage: enqueue_crawl_job');

    // Clean up the audit record we just created since we couldn't queue it
    try {
      const { updateAuditStatus } = await import('@sitenexis/db');
      await updateAuditStatus(audit.id, 'failed', { errorMessage: s.error ?? 'Redis unavailable' });
    } catch { /* best effort cleanup */ }

    return serviceUnavailable(stages);
  }

  // Stage 6: Confirm worker is alive (Redis read — non-fatal)
  let workerAlive = false;
  try {
    const { getRedisConnection, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } = await import('@sitenexis/crawler');
    const heartbeatRaw = await getRedisConnection().get(HEARTBEAT_KEY);
    if (heartbeatRaw) {
      const age = Date.now() - parseInt(heartbeatRaw, 10);
      workerAlive = age < HEARTBEAT_STALE_MS;
    }
    stages.push({ stage: 'worker_heartbeat', status: workerAlive ? 'ok' : 'error', ...(workerAlive ? {} : { error: 'No heartbeat — worker may not be running', recommended_fix: 'Start the BullMQ worker: pnpm --filter @sitenexis/crawler dev:worker. On Vercel, the worker must run as a separate process (Railway, Fly.io, or a dedicated server).' }) });
  } catch {
    stages.push({ stage: 'worker_heartbeat', status: 'skipped', error: 'Could not read heartbeat key' });
  }

  logger.info({ auditId: audit.id, domain, userId: user.id, layer4Enabled, workerAlive }, 'Audit enqueued');

  return NextResponse.json(
    { auditId: audit.id, workerAlive },
    { status: 202 },
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function serviceUnavailable(stages: StageResult[]): NextResponse {
  const failedStage = stages.find((s) => s.status === 'error');
  return NextResponse.json(
    {
      error: 'Service temporarily unavailable.',
      failed_stage: failedStage?.stage ?? 'unknown',
      diagnosis: stages,
    },
    { status: 503 },
  );
}

function startDemoAudit(domain: string): NextResponse {
  const audit = createDemoAudit(domain);
  void runDemoSimulation(audit.id, domain);
  logger.info({ auditId: audit.id, domain, mode: 'demo' }, 'Demo audit started');
  return NextResponse.json({ auditId: audit.id }, { status: 202 });
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
