import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { routeEvent, SEVERITY_ICON } from './routing-policy';
import { shouldSuppressDuplicate } from './dedup';
import { isTelegramConfigured, sendTelegramMessage } from './telegram-provider';
import type { OperationalEvent } from './types';

/** &, <, > must be escaped in any user/crawl-sourced metadata field (domain, finding text) before HTML parse_mode. */
function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatAuditCompleteMessage(event: OperationalEvent): string {
  const m = event.metadata ?? {};
  const domain = m.domain != null ? escapeHtml(String(m.domain)) : 'unknown domain';
  const lines = ['✅ <b>SiteNexis Audit Complete</b>', '', `Domain: ${domain}`, `Status: ${escapeHtml(String(m.status ?? 'complete'))}`];

  const scoreLine = (label: string, key: string) => {
    const v = m[key];
    if (v != null) lines.push(`${label}: ${v}/100`);
  };
  scoreLine('AI Visibility', 'aiVisibility');
  scoreLine('Technical SEO', 'technicalSeo');
  scoreLine('Machine Trust', 'machineTrust');

  lines.push('');
  lines.push(`Intelligence Report: ${m.reportStatus === 'ready' ? 'Ready' : 'Processing'}`);

  if (m.priorityFinding != null) {
    lines.push('');
    lines.push(`Key priority: ${escapeHtml(String(m.priorityFinding))}`);
  }
  if (m.viewUrl != null) {
    lines.push('');
    lines.push(`View: ${String(m.viewUrl)}`);
  }
  lines.push('');
  lines.push(`/audit ${domain}`);
  lines.push(`/report ${domain}`);

  return lines.join('\n');
}

function formatMessage(event: OperationalEvent): string {
  if (event.type === 'AUDIT_COMPLETE') return formatAuditCompleteMessage(event);

  const decision = routeEvent(event);
  const icon = SEVERITY_ICON[decision.severity];
  const lines = [`${icon} <b>${event.type.replace(/_/g, ' ')}</b>`, event.summary];
  if (event.detail) lines.push(event.detail);
  return lines.join('\n');
}

/**
 * Entry point every alert source calls. Never throws — a failure anywhere in
 * this pipeline (routing, dedup, Telegram API) is logged and swallowed, never
 * propagated to the caller. Callers should invoke this as `void notifyOps(...)`
 * from a non-blocking position; it must never be awaited in a way that could
 * fail or delay the operation that produced the event.
 */
export async function notifyOps(event: OperationalEvent): Promise<void> {
  try {
    if (!env.TELEGRAM_ALERTS_ENABLED) return;
    if (!isTelegramConfigured()) return;

    const decision = routeEvent(event);
    if (!decision.shouldNotify) return;

    const suppressed = await shouldSuppressDuplicate(event.dedupeKey, decision.dedupeWindowSeconds);
    if (suppressed) return;

    const sent = await sendTelegramMessage(env.TELEGRAM_ADMIN_CHAT_ID, formatMessage(event));
    if (!sent) {
      logger.warn({ eventType: event.type }, 'Ops alert was not delivered');
    }
  } catch (err) {
    logger.error({ eventType: event.type, err: err instanceof Error ? err.message : String(err) }, 'notifyOps failed — swallowed, never affects the caller');
  }
}
