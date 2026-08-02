import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { routeEvent, SEVERITY_ICON } from './routing-policy';
import { shouldSuppressDuplicate } from './dedup';
import { isTelegramConfigured, sendTelegramMessage } from './telegram-provider';
import type { OperationalEvent } from './types';

function formatMessage(event: OperationalEvent): string {
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
