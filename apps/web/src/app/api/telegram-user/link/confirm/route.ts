export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { rateLimit } from '@/lib/rate-limit';

const ConfirmSchema = z.object({ token: z.string().min(32).max(128) });

const REASON_MESSAGES: Record<string, string> = {
  invalid_or_expired: 'This link has expired or is invalid. Return to Telegram and send /start to request a new one.',
  already_consumed: 'This link has already been used. Return to Telegram and send /start to request a new one.',
  telegram_already_linked: 'That Telegram account is already linked to a different SiteNexis account.',
  sitenexis_already_linked: 'Your SiteNexis account is already linked to a different Telegram account. Disconnect it first from /account in Telegram.',
};

/**
 * The one and only place a Telegram identity becomes linked to a SiteNexis
 * account — requires an authenticated SiteNexis browser session (never a
 * bearer token or credential passed through Telegram itself).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const rl = await rateLimit('telegram-link-confirm', user.id, { limit: 10, windowSec: 3_600 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429, headers: rl.headers });
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }); }

  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid or missing token' }, { status: 400 });

  const { confirmTelegramLink } = await import('@/lib/telegram-user/account-linking');
  const result = await confirmTelegramLink(parsed.data.token, user.id);

  if (!result.success) {
    return NextResponse.json({ error: REASON_MESSAGES[result.reason] ?? 'Linking failed.', reason: result.reason }, { status: 409 });
  }

  return NextResponse.json({ success: true });
}
