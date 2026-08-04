import { randomBytes, createHash } from 'crypto';
import { env } from '@/lib/env';

const TOKEN_TTL_MS = 10 * 60_000; // ~10 minutes

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

/**
 * Generates a fresh, opaque, single-use linking token and persists only its
 * hash — the raw value is returned exactly once, for embedding in the
 * deep-link sent to the user, and is never logged or stored anywhere.
 */
export async function startTelegramLink(telegramUserId: string, telegramChatId: string): Promise<{ linkUrl: string; expiresAt: Date }> {
  const { createLinkToken } = await import('@sitenexis/db');

  const rawToken = randomBytes(32).toString('hex');
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

  await createLinkToken({ tokenHash, telegramUserId, telegramChatId, expiresAt });

  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const linkUrl = `${base}/link-telegram?token=${rawToken}`;
  return { linkUrl, expiresAt };
}

export type ConfirmTelegramLinkResult =
  | { success: true }
  | { success: false; reason: 'invalid_or_expired' | 'already_consumed' | 'telegram_already_linked' | 'sitenexis_already_linked' };

/** Called only from the authenticated browser confirmation route — never from Telegram itself. */
export async function confirmTelegramLink(rawToken: string, siteNexisUserId: string): Promise<ConfirmTelegramLinkResult> {
  const { confirmLinkToken } = await import('@sitenexis/db');
  const tokenHash = hashToken(rawToken);
  const result = await confirmLinkToken(tokenHash, siteNexisUserId);
  if (!result.success) return { success: false, reason: result.reason ?? 'invalid_or_expired' };
  return { success: true };
}
