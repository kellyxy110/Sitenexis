export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { after } from 'next/server';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';
import { rateLimit } from '@/lib/rate-limit';

// Private IP ranges that must never be fetched (SSRF protection)
const PRIVATE_IP_RE =
  /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|169\.254\.|::1|fc00:|fe80:)/i;
const DOMAIN_RE = /^[a-z0-9]([a-z0-9\-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9\-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

const StartAuditSchema = z.object({
  domain: z
    .string()
    .min(1)
    .max(253)
    .transform((d) => d.trim().toLowerCase().replace(/^https?:\/\//i, '').replace(/\/.*$/, ''))
    .refine((d) => DOMAIN_RE.test(d), { message: 'Invalid domain format' })
    .refine((d) => !PRIVATE_IP_RE.test(d), { message: 'Private or reserved domains are not allowed' }),
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

  const rl = await rateLimit('audit:start', user.id, { limit: 10, windowSec: 60 });
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'Too many audit requests. Please wait before starting another audit.' },
      { status: 429, headers: rl.headers },
    );
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

  if (!isFullyConfigured()) {
    return NextResponse.json(
      {
        error: 'No data available — configure your database and run an audit.',
        detail: 'Connect a Supabase project and run pnpm db:push to enable audit functionality.',
      },
      { status: 503 },
    );
  }

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

  // Stage 3: Layer 4 access check
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

  // Stage 5: Check worker heartbeat
  let executionMode: 'bullmq' | 'serverless' = 'serverless';
  let workerAlive = false;

  try {
    const { getRedisUrl, createRedisClient, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } = await import('@sitenexis/crawler');
    if (getRedisUrl()) {
      const probe = createRedisClient(false);
      try {
        const heartbeatRaw = await probe.get(HEARTBEAT_KEY);
        workerAlive = heartbeatRaw
          ? Date.now() - parseInt(heartbeatRaw, 10) < HEARTBEAT_STALE_MS
          : false;
      } finally {
        probe.disconnect();
      }
    }
  } catch { /* Redis unreachable — no worker possible */ }

  if (workerAlive) {
    try {
      const { enqueueCrawlJob } = await import('@sitenexis/crawler');
      await enqueueCrawlJob({ auditId: audit.id, domain, userId: user.id, layer4Enabled });
      executionMode = 'bullmq';
      stages.push({ stage: 'enqueue_crawl_job', status: 'ok' });
      stages.push({ stage: 'worker_heartbeat', status: 'ok' });
    } catch (enqErr) {
      stages.push({
        stage: 'enqueue_crawl_job',
        status: 'error',
        error: enqErr instanceof Error ? enqErr.message : String(enqErr),
        recommended_fix: 'Redis connection failed during enqueue despite heartbeat check. Running serverless fallback.',
      });
    }
  } else {
    stages.push({
      stage: 'worker_heartbeat',
      status: 'error',
      error: 'No active worker heartbeat — using serverless execution.',
      recommended_fix: 'Deploy the BullMQ worker on Railway/Render/Fly.io for full Puppeteer-based crawls. See docs/worker-hosting.md.',
    });
  }

  // Stage 6: Run audit
  if (executionMode === 'serverless') {
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
    stages.push({ stage: 'serverless_audit_scheduled', status: 'ok' });
  }

  logger.info({ auditId: audit.id, domain, userId: user.id, layer4Enabled, executionMode, workerAlive }, 'Audit started');

  return NextResponse.json({ auditId: audit.id, executionMode, workerAlive }, { status: 202 });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
