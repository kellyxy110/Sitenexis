import { timingSafeEqual, createHash } from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

export function isTelegramConfigured(): boolean {
  return env.TELEGRAM_BOT_TOKEN.length > 0 && env.TELEGRAM_ADMIN_CHAT_ID.length > 0;
}

/** Timing-safe comparison so the secret can't be brute-forced via response-time side channel. */
export function isValidWebhookSecret(headerValue: string | null): boolean {
  if (!env.TELEGRAM_WEBHOOK_SECRET || !headerValue) return false;
  const a = createHash('sha256').update(headerValue).digest();
  const b = createHash('sha256').update(env.TELEGRAM_WEBHOOK_SECRET).digest();
  return timingSafeEqual(a, b);
}

/**
 * The admin allowlist IS the access control for commands — not a bypass of one.
 * Only the configured TELEGRAM_ADMIN_CHAT_ID may issue commands; every other
 * chat ID (including the bot's own creator, if different) is rejected.
 *
 * Both sides are trimmed before comparison — Telegram's own chat.id is always
 * clean digits, but the configured value is whatever was pasted into the
 * Vercel dashboard, where a trailing space or newline is an easy, invisible
 * mistake that would otherwise make an exact-match comparison silently fail.
 */
export function isAdminChat(chatId: string | number): boolean {
  const configured = env.TELEGRAM_ADMIN_CHAT_ID.trim();
  return configured.length > 0 && String(chatId).trim() === configured;
}

/**
 * The URL contains the bot token as a path segment — this constant exists so
 * every call site redacts it the same way before logging, rather than each
 * catch block needing to remember to.
 */
function redactedApiLabel(method: string): string {
  return `${TELEGRAM_API_BASE}/bot[REDACTED]/${method}`;
}

export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram: TELEGRAM_BOT_TOKEN not configured — message not sent');
    return false;
  }
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.error({ status: res.status, endpoint: redactedApiLabel('sendMessage'), body: body.slice(0, 300) }, 'Telegram sendMessage failed');
      return false;
    }
    return true;
  } catch (err) {
    logger.error({ endpoint: redactedApiLabel('sendMessage'), err: err instanceof Error ? err.message : String(err) }, 'Telegram sendMessage request failed');
    return false;
  }
}

/** Fetches the numeric chat id for whoever most recently messaged the bot — used once during setup, never persisted here. */
export async function getLatestChatId(): Promise<number | null> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/getUpdates?limit=1&offset=-1`);
    if (!res.ok) return null;
    const data = await res.json() as { ok: boolean; result?: Array<{ message?: { chat?: { id?: number } } }> };
    return data.result?.[0]?.message?.chat?.id ?? null;
  } catch (err) {
    logger.error({ endpoint: redactedApiLabel('getUpdates'), err: err instanceof Error ? err.message : String(err) }, 'Telegram getUpdates request failed');
    return null;
  }
}
