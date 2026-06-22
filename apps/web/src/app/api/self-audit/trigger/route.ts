export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { after } from 'next/server';
import { type NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual, createHash } from 'crypto';
import { z } from 'zod';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const SYSTEM_USER_EMAIL = 'system@sitenexis.com';
const SELF_AUDIT_DOMAIN = 'sitenexis.vercel.app';

const TriggerSchema = z.object({
  triggeredBy: z.enum(['deploy', 'cron', 'manual']).default('manual'),
  secret: z.string(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = TriggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const expected = env.SELF_AUDIT_SECRET ?? '';
  if (!expected) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const a = createHash('sha256').update(parsed.data.secret).digest();
  const b = createHash('sha256').update(expected).digest();
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { triggeredBy } = parsed.data;

  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Service not configured — connect a database to enable self-audit.' }, { status: 503 });
  }

  try {
    const { createSelfAuditRun } = await import('@sitenexis/db');
    const { upsertUser, updateUserPlan, createAudit } = await import('@sitenexis/db');

    await upsertUser(SYSTEM_USER_ID, SYSTEM_USER_EMAIL);
    await updateUserPlan(SYSTEM_USER_ID, 'enterprise');

    const selfAuditRunId = await createSelfAuditRun(triggeredBy, SELF_AUDIT_DOMAIN);
    const audit = await createAudit(SYSTEM_USER_ID, SELF_AUDIT_DOMAIN);

    // Try BullMQ worker first, fall back to serverless
    let executionMode: 'bullmq' | 'serverless' = 'serverless';
    try {
      const { getRedisUrl, createRedisClient, HEARTBEAT_KEY, HEARTBEAT_STALE_MS } = await import('@sitenexis/crawler');
      if (getRedisUrl()) {
        const probe = createRedisClient(false);
        try {
          const heartbeatRaw = await probe.get(HEARTBEAT_KEY);
          const workerAlive = heartbeatRaw
            ? Date.now() - parseInt(heartbeatRaw, 10) < HEARTBEAT_STALE_MS
            : false;
          if (workerAlive) {
            const { enqueueCrawlJob } = await import('@sitenexis/crawler');
            await enqueueCrawlJob({
              auditId: audit.id,
              domain: SELF_AUDIT_DOMAIN,
              userId: SYSTEM_USER_ID,
              layer4Enabled: true,
              selfAuditRunId,
            });
            executionMode = 'bullmq';
          }
        } finally {
          probe.disconnect();
        }
      }
    } catch { /* Redis unavailable — use serverless */ }

    if (executionMode === 'serverless') {
      after(async () => {
        try {
          const { runServerlessAudit } = await import('@/lib/serverless-audit');
          await runServerlessAudit(audit.id, SELF_AUDIT_DOMAIN, SYSTEM_USER_ID, selfAuditRunId);
        } catch (auditErr) {
          logger.error({ auditId: audit.id, err: auditErr }, 'Self-audit serverless execution failed');
          try {
            const { updateAuditStatus } = await import('@sitenexis/db');
            await updateAuditStatus(audit.id, 'failed', {
              errorMessage: auditErr instanceof Error ? auditErr.message : 'Self-audit failed',
            });
          } catch { /* best effort */ }
        }
      });
    }

    logger.info({ selfAuditRunId, auditId: audit.id, triggeredBy, executionMode }, 'Self-audit triggered');

    return NextResponse.json({
      selfAuditRunId,
      auditId: audit.id,
      status: executionMode === 'bullmq' ? 'queued' : 'running',
      executionMode,
    }, { status: 202 });
  } catch (err) {
    logger.error({ err }, 'Self-audit trigger failed');
    return NextResponse.json({ error: 'Failed to trigger self-audit' }, { status: 503 });
  }
}
