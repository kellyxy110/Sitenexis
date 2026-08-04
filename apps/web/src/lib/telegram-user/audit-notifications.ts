/**
 * Real audit-completion notifications for the Telegram User Assistant.
 * Wired into serverless-audit.ts's completion, partial, and failure paths.
 *
 * Never throws — a Telegram delivery failure must never affect audit
 * completion or any caller's control flow. Callers should still wrap calls
 * in their own try/catch as defense in depth, but this function guarantees
 * it resolves rather than rejects under normal error conditions.
 *
 * Notifications go only to the linked user's own Telegram chat — resolved
 * strictly via siteNexisUserId, never a domain-based or cross-user lookup.
 */
import { logger } from '@/lib/logger';

export type TelegramAuditNotificationStatus = 'complete' | 'partial' | 'failed';

export async function notifyTelegramUserAuditResult(
  userId: string,
  domain: string,
  status: TelegramAuditNotificationStatus,
  auditId?: string,
): Promise<void> {
  try {
    const { getConnectionBySiteNexisUserId, getNotificationPreference } = await import('@sitenexis/db');
    const connection = await getConnectionBySiteNexisUserId(userId);
    if (!connection || connection.status !== 'linked') return;

    const pref = await getNotificationPreference(connection.id);
    const shouldNotify =
      status === 'complete' ? (pref?.notifyOnComplete ?? true)
      : status === 'partial' ? (pref?.notifyOnPartial ?? true)
      : (pref?.notifyOnFailed ?? true);
    if (!shouldNotify) return;

    const { sendUserBotMessage } = await import('@/lib/telegram-user/provider');
    const { escapeHtml } = await import('@/lib/telegram-ops/commands');
    const { auditResultKeyboard } = await import('@/lib/telegram-user/keyboards');

    // Only surface the persisted Executive Assessment when the canonical
    // report is actually ready — never generated here, never for a failed
    // audit. getExecutiveSummary is read-only (DB-first, Redis-fallback,
    // never-generate), so this can never trigger an LLM call from the
    // notification path, and a missing/unready report simply omits the
    // section rather than blocking or faking the notification.
    let executiveAssessment: ExecutiveAssessmentExcerpt | null = null;
    if (auditId && status !== 'failed') {
      try {
        const { getExecutiveSummary } = await import('@/lib/audit-intelligence/executive-summary-service');
        const summary = await getExecutiveSummary(auditId);
        if (summary?.data) {
          executiveAssessment = {
            compositeScore: summary.data.composite_score,
            compositeLabel: summary.data.composite_label,
            overallVerdict: summary.data.overall_verdict,
          };
        }
      } catch { /* report not ready — omit the section, never block the notification */ }
    }

    // Result-action buttons only make sense once there's something to view —
    // a failed audit has no scores/issues/report to jump to.
    const keyboard = status !== 'failed' ? { inline_keyboard: auditResultKeyboard() } : undefined;
    await sendUserBotMessage(connection.telegramChatId, buildNotificationText(domain, status, escapeHtml, executiveAssessment), keyboard);
  } catch (err) {
    logger.warn({ err, userId, domain, status }, 'Telegram user-bot audit notification failed (non-fatal)');
  }
}

interface ExecutiveAssessmentExcerpt {
  compositeScore: number;
  compositeLabel: string;
  overallVerdict: string;
}

function buildNotificationText(
  domain: string,
  status: TelegramAuditNotificationStatus,
  escapeHtml: (value: string) => string,
  executiveAssessment: ExecutiveAssessmentExcerpt | null,
): string {
  const safeDomain = escapeHtml(domain);
  const assessmentBlock = executiveAssessment
    ? ['', '<b>Executive Assessment</b>', `${executiveAssessment.compositeScore.toFixed(1)}/10 — ${escapeHtml(executiveAssessment.compositeLabel)}`, escapeHtml(executiveAssessment.overallVerdict)]
    : [];
  switch (status) {
    case 'complete':
      return ['<b>Audit complete</b>', safeDomain, ...assessmentBlock, '', 'Send /status for details, or /report for the full intelligence report.'].join('\n');
    case 'partial':
      return ['<b>Audit finished with partial results</b>', safeDomain, 'Layer 4 analysis did not complete.', ...assessmentBlock, '', 'Send /status for details.'].join('\n');
    case 'failed':
      return ['<b>Audit failed</b>', safeDomain, '', 'Send /status for details, or /audit to try again.'].join('\n');
  }
}
