import { timingSafeEqual, createHash } from 'crypto';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';

const TELEGRAM_API_BASE = 'https://api.telegram.org';

/**
 * Fully separate client for the SiteNexis User Assistant bot — deliberately
 * not shared with lib/telegram-ops/telegram-provider.ts (the admin Ops
 * console), which uses a different token and a different webhook secret.
 * Keeping these isolated means a bug or key rotation in one can never touch
 * the other.
 */

export function isUserBotConfigured(): boolean {
  return env.TELEGRAM_USER_BOT_TOKEN.length > 0;
}

export function isValidUserBotWebhookSecret(headerValue: string | null): boolean {
  if (!env.TELEGRAM_USER_BOT_WEBHOOK_SECRET || !headerValue) return false;
  const a = createHash('sha256').update(headerValue).digest();
  const b = createHash('sha256').update(env.TELEGRAM_USER_BOT_WEBHOOK_SECRET).digest();
  return timingSafeEqual(a, b);
}

function redactedApiLabel(method: string): string {
  return `${TELEGRAM_API_BASE}/bot[REDACTED]/${method}`;
}

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}

export type InlineKeyboard = InlineKeyboardButton[][];

async function postToTelegram(
  chatId: string,
  text: string,
  options?: { parseMode?: 'HTML'; replyMarkup?: { inline_keyboard: InlineKeyboard } },
): Promise<{ ok: boolean; errorCode?: number; description?: string }> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.TELEGRAM_USER_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(options?.parseMode ? { parse_mode: options.parseMode } : {}),
        ...(options?.replyMarkup ? { reply_markup: options.replyMarkup } : {}),
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) return { ok: true };
    let parsed: { error_code?: number; description?: string } = {};
    try { parsed = await res.json() as typeof parsed; } catch { /* non-JSON error body */ }
    return { ok: false, errorCode: parsed.error_code ?? res.status, ...(parsed.description !== undefined ? { description: parsed.description } : {}) };
  } catch (err) {
    logger.error({ endpoint: redactedApiLabel('sendMessage'), err: err instanceof Error ? err.message : String(err) }, 'Telegram user-bot sendMessage request failed');
    return { ok: false };
  }
}

export async function sendUserBotMessage(
  chatId: string,
  text: string,
  replyMarkup?: { inline_keyboard: InlineKeyboard },
): Promise<boolean> {
  if (!isUserBotConfigured()) {
    logger.warn('Telegram user bot: TELEGRAM_USER_BOT_TOKEN not configured — message not sent');
    return false;
  }
  const result = await postToTelegram(chatId, text, { parseMode: 'HTML', ...(replyMarkup ? { replyMarkup } : {}) });
  if (!result.ok) {
    logger.error({ endpoint: redactedApiLabel('sendMessage'), status: result.errorCode, description: result.description?.slice(0, 200) }, 'Telegram user-bot sendMessage failed');
  }
  return result.ok;
}

/** Answers a callback query so Telegram stops showing the loading spinner on the tapped button. */
export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  if (!isUserBotConfigured()) return;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${env.TELEGRAM_USER_BOT_TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id: callbackQueryId, ...(text ? { text } : {}) }),
    });
  } catch (err) {
    logger.error({ endpoint: redactedApiLabel('answerCallbackQuery'), err: err instanceof Error ? err.message : String(err) }, 'Telegram user-bot answerCallbackQuery failed');
  }
}
