import { checkDatabase, checkRedis, checkWorkerHeartbeat } from '@/lib/health-checks';

const SINCE_24H = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

/** Builds the daily operational digest message. Pure aggregation, no side effects. */
export async function buildDailyDigest(): Promise<string> {
  const { countAuditsByStatusSince, listAuditsByStatusForOps } = await import('@sitenexis/db');
  const since = SINCE_24H();

  const [counts, failed, db, redis, worker] = await Promise.all([
    countAuditsByStatusSince(since),
    listAuditsByStatusForOps(['failed'], since, 5),
    checkDatabase(),
    checkRedis(),
    checkWorkerHeartbeat(),
  ]);

  const total = Object.values(counts).reduce((a: number, b: number) => a + b, 0);
  const infraOk = db.status === 'ok' && redis.status === 'ok' && worker.status !== 'error';

  const lines = [
    '<b>📊 Daily Ops Digest</b>',
    `Audits (24h): ${total} total — ${counts.complete} complete, ${counts.partial} partial, ${counts.failed} failed, ${counts.running} running`,
    `Infrastructure: ${infraOk ? '✅ healthy' : '🔴 issues detected'}`,
  ];

  if (failed.length > 0) {
    lines.push('', '<b>Recent failures:</b>');
    for (const a of failed) {
      lines.push(`🔴 ${a.domain}${a.errorMessage ? ` — ${a.errorMessage.slice(0, 100)}` : ''}`);
    }
  }

  return lines.join('\n');
}
