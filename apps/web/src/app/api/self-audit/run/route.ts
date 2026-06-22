export const dynamic = 'force-dynamic';
export const maxDuration = 300;
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { isFullyConfigured } from '@/lib/mode';

const OWNER_EMAILS = new Set([
  'kellyxy110@gmail.com',
  'luchijudith@gmail.com',
  'judithluchi@gmail.com',
]);

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const SYSTEM_USER_EMAIL = 'system@sitenexis.com';
const SELF_AUDIT_DOMAIN = 'sitenexis.vercel.app';

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  if (!OWNER_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Only the owner can trigger self-audits' }, { status: 403 });
  }

  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Service not configured — connect a database to enable self-audit.' }, { status: 503 });
  }

  try {
    const { createSelfAuditRun, upsertUser, updateUserPlan, createAudit } = await import('@sitenexis/db');

    await upsertUser(SYSTEM_USER_ID, SYSTEM_USER_EMAIL);
    await updateUserPlan(SYSTEM_USER_ID, 'enterprise');

    const selfAuditRunId = await createSelfAuditRun('manual', SELF_AUDIT_DOMAIN);
    const audit = await createAudit(SYSTEM_USER_ID, SELF_AUDIT_DOMAIN);

    // Try BullMQ worker first
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
            logger.info({ selfAuditRunId, auditId: audit.id }, 'Self-audit queued via BullMQ worker');
            return NextResponse.json({
              selfAuditRunId, auditId: audit.id, status: 'queued', executionMode: 'bullmq',
            }, { status: 202 });
          }
        } finally {
          probe.disconnect();
        }
      }
    } catch { /* Redis unavailable — fall through to synchronous */ }

    // No BullMQ worker — run synchronously within this request (maxDuration = 300s)
    // This is more reliable than after() which can be cut off by Vercel's background task limits
    logger.info({ selfAuditRunId, auditId: audit.id }, 'Self-audit starting synchronously');
    try {
      const { runServerlessAudit } = await import('@/lib/serverless-audit');
      await runServerlessAudit(audit.id, SELF_AUDIT_DOMAIN, SYSTEM_USER_ID, selfAuditRunId);
    } catch (auditErr) {
      logger.error({ auditId: audit.id, err: auditErr }, 'Self-audit synchronous execution failed');
      try {
        const { updateAuditStatus } = await import('@sitenexis/db');
        await updateAuditStatus(audit.id, 'failed', {
          errorMessage: auditErr instanceof Error ? auditErr.message : 'Self-audit failed',
        });
      } catch { /* best effort */ }
      return NextResponse.json({ error: 'Self-audit failed — check logs' }, { status: 500 });
    }

    return NextResponse.json({
      selfAuditRunId, auditId: audit.id, status: 'complete', executionMode: 'serverless',
    }, { status: 200 });

  } catch (err) {
    logger.error({ err }, 'Self-audit manual trigger failed');
    return NextResponse.json({ error: 'Failed to trigger self-audit' }, { status: 503 });
  }
}
