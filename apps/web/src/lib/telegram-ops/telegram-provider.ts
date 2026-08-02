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

// ── Message-length safety ───────────────────────────────────────────────────
// Telegram's hard limit is 4096 UTF-16 code units. We stay well under it and
// split on newline boundaries only — never mid-character, mid-entity, or
// mid-tag — since every message we build is line-oriented (one finding/audit
// per line) and our only markup is a single <b>...</b> pair on the title line.

const CHUNK_SOFT_LIMIT = 3500;
const MAX_CHUNKS = 3;
const TRUNCATION_NOTICE = '\n\n… truncated. See the SiteNexis dashboard for the full list.';

function chunkForTelegram(text: string): string[] {
  const lines = text.split('\n').map((line) =>
    line.length > CHUNK_SOFT_LIMIT ? `${line.slice(0, CHUNK_SOFT_LIMIT - 1)}…` : line,
  );

  const chunks: string[] = [];
  let current = '';
  for (const line of lines) {
    const candidate = current ? `${current}\n${line}` : line;
    if (candidate.length > CHUNK_SOFT_LIMIT && current) {
      chunks.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);

  if (chunks.length > MAX_CHUNKS) {
    const kept = chunks.slice(0, MAX_CHUNKS);
    kept[kept.length - 1] = kept[kept.length - 1]! + TRUNCATION_NOTICE;
    return kept;
  }
  return chunks;
}

// ── HTML entity-parse rejection → plain-text fallback ───────────────────────
// Telegram's HTML parser rejects the entire message on any malformed markup
// (an unescaped &, an unbalanced tag, an unsupported tag). Rather than trust
// every call site to produce perfect HTML, sendTelegramMessage retries once
// with the same content stripped to plain text — which can never fail entity
// parsing because no parse_mode is sent at all.

function toPlainTextFallback(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function isEntityParseError(errorCode: number | undefined, description: string | undefined): boolean {
  if (errorCode !== 400) return false;
  return /can't parse entities|can't find end of|unsupported start tag|unclosed/i.test(description ?? '');
}

interface TelegramSendOutcome {
  ok: boolean;
  errorCode?: number | undefined;
  description?: string | undefined;
  networkError?: string | undefined;
}

async function postToTelegram(chatId: string, text: string, parseMode: 'HTML' | undefined): Promise<TelegramSendOutcome> {
  try {
    const res = await fetch(`${TELEGRAM_API_BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
      }),
    });
    if (res.ok) return { ok: true };

    // Telegram's error body is JSON: { ok: false, error_code, description }.
    // Parsing it (instead of just logging raw text) is what lets us tell an
    // entity-parse failure — retryable with a plain-text fallback — apart
    // from auth/rate-limit/network failures, which must not be retried.
    let parsed: { error_code?: number; description?: string } = {};
    try {
      parsed = (await res.json()) as { error_code?: number; description?: string };
    } catch {
      /* non-JSON error body — fall through with no description */
    }
    return { ok: false, errorCode: parsed.error_code ?? res.status, description: parsed.description };
  } catch (err) {
    return { ok: false, networkError: err instanceof Error ? err.message : String(err) };
  }
}

/**
 * Sends a message, chunking it to stay under Telegram's length limit and
 * retrying once as plain text if — and only if — Telegram specifically
 * rejects the HTML for a malformed-entity reason. Auth failures (401),
 * forbidden/blocked (403), rate limits (429), and network errors are never
 * retried — those need a human, not a resend. The bot token, webhook secret,
 * and full Telegram API URL are never included in any log line.
 */
export async function sendTelegramMessage(chatId: string, text: string): Promise<boolean> {
  if (!env.TELEGRAM_BOT_TOKEN) {
    logger.warn('Telegram: TELEGRAM_BOT_TOKEN not configured — message not sent');
    return false;
  }

  let allOk = true;
  for (const chunk of chunkForTelegram(text)) {
    const result = await postToTelegram(chatId, chunk, 'HTML');
    if (result.ok) continue;

    if (result.networkError) {
      logger.error({ endpoint: redactedApiLabel('sendMessage'), err: result.networkError }, 'Telegram sendMessage request failed');
      allOk = false;
      continue;
    }

    const parseError = isEntityParseError(result.errorCode, result.description);
    logger.error({
      endpoint: redactedApiLabel('sendMessage'),
      status: result.errorCode,
      description: result.description?.slice(0, 200),
      willRetryPlainText: parseError,
    }, 'Telegram sendMessage failed');

    if (!parseError) {
      allOk = false;
      continue;
    }

    const fallback = await postToTelegram(chatId, toPlainTextFallback(chunk), undefined);
    if (!fallback.ok) {
      logger.error({
        endpoint: redactedApiLabel('sendMessage'),
        status: fallback.errorCode,
        description: fallback.description?.slice(0, 200),
      }, 'Telegram sendMessage plain-text fallback also failed');
      allOk = false;
    }
  }
  return allOk;
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
