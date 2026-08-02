export const dynamic = 'force-dynamic';
export const maxDuration = 60;
/**
 * Daily operational digest, sent to the Telegram admin chat. Vercel
 * Cron-triggered, authorized via CRON_SECRET (same pattern as
 * /api/cron/google-sync).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { logger } from '@/lib/logger';
import { buildDailyDigest } from '@/lib/telegram-ops/digest';
import { isTelegramConfigured, sendTelegramMessage } from '@/lib/telegram-ops/telegram-provider';

export async function GET(req: NextRequest): Promise<NextResponse> {
  if (!env.CRON_SECRET || req.headers.get('authorization') !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!env.TELEGRAM_ALERTS_ENABLED || !isTelegramConfigured()) {
    return NextResponse.json({ skipped: true, reason: 'Telegram ops alerts not enabled/configured' });
  }

  try {
    const digest = await buildDailyDigest();
    const sent = await sendTelegramMessage(env.TELEGRAM_ADMIN_CHAT_ID, digest);
    return NextResponse.json({ sent });
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Ops digest cron failed');
    return NextResponse.json({ error: 'Digest generation failed' }, { status: 500 });
  }
}
