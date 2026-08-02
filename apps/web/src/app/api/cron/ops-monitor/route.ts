export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/**
 * Frequent operational monitor — checks for stalled audits and worker health
 * degradation, and raises Telegram alerts via notifyOps (which already
 * dedupes repeats within each event's window, so this can run every few
 * minutes without spamming). Vercel Cron-triggered, authorized via
 * CRON_SECRET.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { checkWorkerHeartbeat } from '@/lib/health-checks';
import { notifyOps } from '@/lib/telegram-ops/orchestrator';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { listStalledAuditsForOps } = await import('@sitenexis/db');
  const now = new Date().toISOString();

  const [stalled, worker] = await Promise.all([
    listStalledAuditsForOps(20).catch((err: unknown) => {
      logger.error({ err: err instanceof Error ? err.message : String(err) }, 'ops-monitor: stalled-audit lookup failed');
      return [];
    }),
    checkWorkerHeartbeat(),
  ]);

  for (const audit of stalled) {
    await notifyOps({
      type: 'AUDIT_STALLED',
      summary: `Audit for ${audit.domain} has been running since ${audit.startedAt?.toISOString() ?? audit.createdAt.toISOString()} with no update.`,
      dedupeKey: `audit-stalled:${audit.id}`,
      occurredAt: now,
      metadata: { auditId: audit.id, domain: audit.domain },
    });
  }

  if (worker.status === 'error') {
    await notifyOps({
      type: 'WORKER_HEALTH_DEGRADED',
      summary: 'Worker heartbeat check failed.',
      detail: worker.error,
      dedupeKey: 'worker-health-degraded',
      occurredAt: now,
    });
  }

  return NextResponse.json({ stalledCount: stalled.length, workerStatus: worker.status });
}
