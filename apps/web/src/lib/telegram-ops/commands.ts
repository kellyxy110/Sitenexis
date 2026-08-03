import {
  checkDatabase,
  checkRedis,
  checkBullMQQueue,
  checkWorkerHeartbeat,
} from '@/lib/health-checks';
import { logger } from '@/lib/logger';
import { deriveModuleAndProviderState, type RawAgentManifestLike } from '@/lib/intelligence-report-v2-modules';
import type { ScoutAnalysisResult } from '@sitenexis/shared';

const SINCE_24H = () => new Date(Date.now() - 24 * 60 * 60 * 1000);

// Every non-/status command bounds its DB/Redis work to this ceiling. Without
// it, a slow or hung dependency call would never resolve or reject — it would
// just make the whole webhook function run past the platform's execution
// limit with no response ever sent back to Telegram, which looks identical
// to "no reply" from the user's side and is far harder to diagnose than a
// deliberate, prompt degraded-state message.
const COMMAND_TIMEOUT_MS = 8_000;

class CommandTimeoutError extends Error {}

function withTimeout<T>(promise: Promise<T>, ms = COMMAND_TIMEOUT_MS): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new CommandTimeoutError(`Timed out after ${ms}ms`)), ms);
    }),
  ]);
}

/**
 * Every command handler below reports its own degraded state instead of
 * throwing — a dependency being slow or unavailable must produce a concise
 * Telegram reply, never silence. The raw error is logged server-side only;
 * it is never echoed into the Telegram message, since exception text from a
 * DB/Redis client can occasionally include connection details.
 */
async function runCommand(label: string, title: string, fn: () => Promise<string>): Promise<string> {
  try {
    return await withTimeout(fn());
  } catch (err) {
    const timedOut = err instanceof CommandTimeoutError;
    logger.error({ command: label, timedOut, err: err instanceof Error ? err.message : String(err) }, 'Telegram command handler degraded');
    return `<b>${title}</b>\n⚠️ Degraded — ${timedOut ? 'the underlying data source did not respond in time' : 'could not load data right now'}. Check server logs.`;
  }
}

export function fmtTime(d: Date | null): string {
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
  return runCommand('audits', 'Recent Audits', async () => {
    const { listRecentAuditsForOps } = await import('@sitenexis/db');
    const audits = await listRecentAuditsForOps(10);

    if (audits.length === 0) return '<b>Recent Audits</b>\nNo recent audits found.';

    const statusIcon: Record<string, string> = {
      queued: '⏳', running: '🔄', partial: '🟡', complete: '✅', failed: '🔴',
    };

    const lines = audits.map(
      (a) => `${statusIcon[a.status] ?? '•'} <b>${escapeHtml(a.domain)}</b> — ${a.status} (${fmtAgeMinutes(a.createdAt)})`,
    );
    return ['<b>Recent Audits</b> (last 10)', ...lines].join('\n');
  });
}

/** /failures — failed or partial audits in the last 24h. */
export async function commandFailures(): Promise<string> {
  return runCommand('failures', 'Failures (24h)', async () => {
    const { listAuditsByStatusForOps, listStalledAuditsForOps } = await import('@sitenexis/db');
    const [failed, stalled] = await Promise.all([
      listAuditsByStatusForOps(['failed', 'partial'], SINCE_24H(), 15),
      listStalledAuditsForOps(20),
    ]);

    if (failed.length === 0 && stalled.length === 0) {
      return '<b>Failures (24h)</b>\nNo recent failures.';
    }

    const lines: string[] = ['<b>Failures (24h)</b>'];
    for (const a of failed) {
      const icon = a.status === 'failed' ? '🔴' : '🟡';
      const reason = a.errorMessage ? ` — ${escapeHtml(a.errorMessage.slice(0, 120))}` : '';
      lines.push(`${icon} <b>${escapeHtml(a.domain)}</b> ${a.status}${reason} (${fmtAgeMinutes(a.createdAt)})`);
    }
    for (const a of stalled) {
      lines.push(`⏸ <b>${escapeHtml(a.domain)}</b> stalled — running since ${fmtTime(a.startedAt)}`);
    }
    return lines.join('\n');
  });
}

/** /providers — aggregate provider/module availability across recent audits. */
export async function commandProviders(): Promise<string> {
  return runCommand('providers', 'Providers', async () => {
    const { listRecentAuditsForOps, db } = await import('@sitenexis/db');
    const recent = await listRecentAuditsForOps(20);

    if (recent.length === 0) return '<b>Providers</b>\nNo recent audits to evaluate.';

    // Single batched query instead of one findUnique per audit — the previous
    // 20 sequential round-trips were the single riskiest part of this command's
    // latency budget under a real DB connection.
    const full = await db.audit.findMany({
      where: { id: { in: recent.map((a) => a.id) } },
      select: { id: true, agentManifest: true, aiVisibilityScores: { select: { citationProbabilityScore: true } }, scoutAnalysis: true },
    });

    const degraded = new Map<string, { count: number; reason: string }>();
    for (const audit of full) {
      const { providers } = deriveModuleAndProviderState({
        agentManifest: (audit.agentManifest ?? undefined) as RawAgentManifestLike | undefined,
        citationProbabilityScore: audit.aiVisibilityScores?.citationProbabilityScore ?? null,
        scoutAnalysis: audit.scoutAnalysis as ScoutAnalysisResult | null | undefined,
      });
      for (const p of providers) {
        if (p.available) continue;
        const existing = degraded.get(p.provider);
        degraded.set(p.provider, { count: (existing?.count ?? 0) + 1, reason: p.reason ?? 'unavailable' });
      }
    }

    if (degraded.size === 0) {
      return `<b>Providers</b> (last ${recent.length} audits)\nAll providers available.`;
    }

    const lines = [`<b>Providers</b> (last ${recent.length} audits)`];
    for (const [provider, info] of degraded) {
      lines.push(`⚠️ <b>${escapeHtml(provider)}</b> — unavailable in ${info.count}/${recent.length}: ${escapeHtml(info.reason.slice(0, 100))}`);
    }
    return lines.join('\n');
  });
}

/** /incidents — currently just an alias view over failures + stalled + worker health, since there is no separate incident store. */
export async function commandIncidents(): Promise<string> {
  return runCommand('incidents', 'Incidents', async () => {
    const [failuresMsg, worker] = await Promise.all([commandFailures(), checkWorkerHeartbeat()]);
    const hasOpenIncident = !failuresMsg.includes('No recent failures.') || worker.status === 'error';
    if (!hasOpenIncident) return '<b>Incidents</b>\nNo open incidents.';
    const workerLine = worker.status === 'error' ? `\n🔴 Worker: ${escapeHtml(worker.error ?? 'unhealthy')}` : '';
    return `<b>Incidents</b>\n${failuresMsg}${workerLine}`;
  });
}

/** /deployments — most recent deployment events recorded by the Vercel deploy webhook, if any have landed. */
export async function commandDeployments(): Promise<string> {
  return runCommand('deployments', 'Deployments', async () => {
    const { getRecentDeploymentEvents } = await import('./deployment-log');
    const rows = await getRecentDeploymentEvents(5);

    if (rows.length === 0) return '<b>Deployments</b>\nNo deployment records available.';

    const icon: Record<string, string> = { READY: '✅', ERROR: '🔴', BUILDING: '🔄', QUEUED: '⏳' };
    const lines = rows.map((r) => `${icon[r.state] ?? '•'} ${r.state} — ${fmtAgeMinutes(new Date(r.recordedAt))}`);
    return ['<b>Deployments</b> (last 5)', ...lines].join('\n');
  });
}

/** Telegram's HTML parse_mode requires &, <, > to be escaped in text content — user-sourced strings (domains, error messages) are never trusted to already be safe. */
export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export { runCommand };

const OPERATIONS_COMMANDS = ['/status', '/audits', '/failures', '/providers', '/incidents', '/deployments'] as const;
const AUDIT_INTELLIGENCE_COMMANDS = ['/audit <domain>', '/scores <domain>', '/issues <domain>', '/recommendations <domain>', '/evidence <domain>', '/report <domain>'] as const;

/** /start — an explicit welcome/help response, distinct from the generic unknown-command fallback in the webhook route. */
export async function commandStart(): Promise<string> {
  return [
    '<b>SiteNexis Ops</b>',
    'Internal operational alerting and read-only audit intelligence for SiteNexis. All commands below are read-only.',
    '',
    '<b>Operations</b>',
    '/start',
    ...OPERATIONS_COMMANDS,
    '',
    '<b>Audit Intelligence</b>',
    ...AUDIT_INTELLIGENCE_COMMANDS,
  ].join('\n');
}

export const COMMANDS: Record<string, (args: string[]) => Promise<string>> = {
  '/start': () => commandStart(),
  '/status': () => commandStatus(),
  '/audits': () => commandAudits(),
  '/failures': () => commandFailures(),
  '/providers': () => commandProviders(),
  '/incidents': () => commandIncidents(),
  '/deployments': () => commandDeployments(),
};
