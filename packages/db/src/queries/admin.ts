import { db } from '../client';

export interface AdminOverview {
  windowDays: number;
  totalUsers: number;
  auditsStarted: number;
  auditsCompleted: number;
  auditsFailed: number;
  avgAuditDurationMs: number | null;
  reportsGenerated: number;
  recommendationsApplied: number;
  connectorFailures: number;
}

/**
 * Aggregated SiteNexis activity for the admin operations view.
 * "organizations" has no separate meaning here — the tenant boundary is the
 * existing User model (no Organization table), so totalUsers covers it.
 * "reports downloaded" isn't tracked server-side (only as a client-side GTM
 * event) — reportsGenerated (Report row creation) is the closest real proxy
 * and is labeled as such, not silently presented as download counts.
 */
export async function getAdminOverview(windowDays = 30): Promise<AdminOverview> {
  const since = new Date(Date.now() - windowDays * 24 * 3_600_000);

  const [totalUsers, auditsStarted, auditsCompleted, auditsFailed, completedAudits, reportsGenerated, recommendationsApplied, connectorFailures] =
    await Promise.all([
      db.user.count(),
      db.audit.count({ where: { createdAt: { gte: since } } }),
      db.audit.count({ where: { status: 'complete', createdAt: { gte: since } } }),
      db.audit.count({ where: { status: 'failed', createdAt: { gte: since } } }),
      db.audit.findMany({
        where: { status: 'complete', createdAt: { gte: since }, startedAt: { not: null }, completedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
        take: 500,
      }),
      db.report.count({ where: { generatedAt: { gte: since } } }),
      db.optimizationSession.count({ where: { status: { in: ['accepted', 'published'] }, updatedAt: { gte: since } } }),
      db.googleSyncLog.count({ where: { status: 'failed', createdAt: { gte: since } } }),
    ]);

  const durations = completedAudits
    .filter((a): a is { startedAt: Date; completedAt: Date } => a.startedAt !== null && a.completedAt !== null)
    .map((a) => a.completedAt.getTime() - a.startedAt.getTime());
  const avgAuditDurationMs = durations.length > 0 ? Math.round(durations.reduce((s, d) => s + d, 0) / durations.length) : null;

  return {
    windowDays,
    totalUsers,
    auditsStarted,
    auditsCompleted,
    auditsFailed,
    avgAuditDurationMs,
    reportsGenerated,
    recommendationsApplied,
    connectorFailures,
  };
}
