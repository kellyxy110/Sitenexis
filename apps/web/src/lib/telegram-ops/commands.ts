import {
  checkDatabase,
  checkRedis,
  checkBullMQQueue,
  checkWorkerHeartbeat,
} from '@/lib/health-checks';
import { deriveModuleAndProviderState, type RawAgentManifestLike } from '@/lib/intelligence-report-v2-modules';
import type { ScoutAnalysisResult } from '@sitenexis/shared';

const SINCE_24H = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

function fmtTime(d: Date | null): string {
  if (!d) return '—';
  return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
}

function fmtAgeMinutes(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

/** /status — infrastructure health, reusing the exact checks behind /api/health. */
export async function commandStatus(): Promise<string> {
  const [db, redis, bullmq, worker] = await Promise.all([
    checkDatabase(),
    checkRedis(),
    checkBullMQQueue(),
    checkWorkerHeartbeat(),
  ]);

  const rows = [
    { label: 'Database', stage: db },
    { label: 'Redis', stage: redis },
    { label: 'BullMQ', stage: bullmq },
    { label: 'Worker', stage: worker },
  ];

  const icon = (s: string) => (s === 'ok' ? '✅' : s === 'not_configured' ? '⚪' : '🔴');
  const lines = rows.map((r) => `${icon(r.stage.status)} ${r.label}: ${r.stage.status}${r.stage.latency_ms != null ? ` (${r.stage.latency_ms}ms)` : ''}`);

  const anyError = rows.some((r) => r.stage.status === 'error');
  return [`<b>System Status</b> — ${anyError ? '🔴 degraded' : '✅ operational'}`, ...lines].join('\n');
}

/** /audits — most recent audits across all users. */
export async function commandAudits(): Promise<string> {
  const { listRecentAuditsForOps } = await import('@sitenexis/db');
  const audits = await listRecentAuditsForOps(10);

  if (audits.length === 0) return '<b>Recent Audits</b>\nNo audits found.';

  const statusIcon: Record<string, string> = {
    queued: '⏳', running: '🔄', partial: '🟡', complete: '✅', failed: '🔴',
  };

  const lines = audits.map(
    (a) => `${statusIcon[a.status] ?? '•'} <b>${a.domain}</b> — ${a.status} (${fmtAgeMinutes(a.createdAt)})`,
  );
  return ['<b>Recent Audits</b> (last 10)', ...lines].join('\n');
}

/** /failures — failed or partial audits in the last 24h. */
export async function commandFailures(): Promise<string> {
  const { listAuditsByStatusForOps, listStalledAuditsForOps } = await import('@sitenexis/db');
  const [failed, stalled] = await Promise.all([
    listAuditsByStatusForOps(['failed', 'partial'], SINCE_24H(), 15),
    listStalledAuditsForOps(20),
  ]);

  if (failed.length === 0 && stalled.length === 0) {
    return '<b>Failures (24h)</b>\n✅ None — no failed, partial, or stalled audits.';
  }

  const lines: string[] = ['<b>Failures (24h)</b>'];
  for (const a of failed) {
    const icon = a.status === 'failed' ? '🔴' : '🟡';
    const reason = a.errorMessage ? ` — ${a.errorMessage.slice(0, 120)}` : '';
    lines.push(`${icon} <b>${a.domain}</b> ${a.status}${reason} (${fmtAgeMinutes(a.createdAt)})`);
  }
  for (const a of stalled) {
    lines.push(`⏸ <b>${a.domain}</b> stalled — running since ${fmtTime(a.startedAt)}`);
  }
  return lines.join('\n');
}

/** /providers — aggregate provider/module availability across recent audits. */
export async function commandProviders(): Promise<string> {
  const { listRecentAuditsForOps, db } = await import('@sitenexis/db');
  const recent = await listRecentAuditsForOps(20);

  const degraded = new Map<string, { count: number; reason: string }>();

  for (const summary of recent) {
    const full = await db.audit.findUnique({
      where: { id: summary.id },
      select: { agentManifest: true, aiVisibilityScores: { select: { citationProbabilityScore: true } }, scoutAnalysis: true },
    });
    if (!full) continue;
    const { providers } = deriveModuleAndProviderState({
      agentManifest: (full.agentManifest ?? undefined) as RawAgentManifestLike | undefined,
      citationProbabilityScore: full.aiVisibilityScores?.citationProbabilityScore ?? null,
      scoutAnalysis: full.scoutAnalysis as ScoutAnalysisResult | null | undefined,
    });
    for (const p of providers) {
      if (p.available) continue;
      const existing = degraded.get(p.provider);
      degraded.set(p.provider, { count: (existing?.count ?? 0) + 1, reason: p.reason ?? 'unavailable' });
    }
  }

  if (degraded.size === 0) {
    return `<b>Providers</b> (last ${recent.length} audits)\n✅ No degraded providers detected.`;
  }

  const lines = [`<b>Providers</b> (last ${recent.length} audits)`];
  for (const [provider, info] of degraded) {
    lines.push(`⚠️ <b>${provider}</b> — degraded in ${info.count}/${recent.length}: ${info.reason.slice(0, 100)}`);
  }
  return lines.join('\n');
}

/** /incidents — currently just an alias view over failures + stalled + worker health, since there is no separate incident store. */
export async function commandIncidents(): Promise<string> {
  const [failuresMsg, worker] = await Promise.all([commandFailures(), checkWorkerHeartbeat()]);
  const workerLine = worker.status === 'error' ? `\n🔴 Worker: ${worker.error ?? 'unhealthy'}` : '';
  return `<b>Incidents</b>\n${failuresMsg}${workerLine}`;
}

/** /deployments — most recent deployment events recorded by the Vercel deploy webhook, if any have landed. */
export async function commandDeployments(): Promise<string> {
  const { getRecentDeploymentEvents } = await import('./deployment-log');
  const rows = await getRecentDeploymentEvents(5);

  if (rows.length === 0) return '<b>Deployments</b>\nNo deployment events recorded yet.';

  const icon: Record<string, string> = { READY: '✅', ERROR: '🔴', BUILDING: '🔄', QUEUED: '⏳' };
  const lines = rows.map((r) => `${icon[r.state] ?? '•'} ${r.state} — ${fmtAgeMinutes(new Date(r.recordedAt))}`);
  return ['<b>Deployments</b> (last 5)', ...lines].join('\n');
}

export const COMMANDS: Record<string, () => Promise<string>> = {
  '/status': commandStatus,
  '/audits': commandAudits,
  '/failures': commandFailures,
  '/providers': commandProviders,
  '/incidents': commandIncidents,
  '/deployments': commandDeployments,
};
