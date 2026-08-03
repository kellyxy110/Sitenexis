export const dynamic = 'force-dynamic';
/**
 * Telegram webhook — receives updates from @SiteNexisOpsBot and dispatches
 * read-only ops commands. Configure with:
 *   https://api.telegram.org/bot<TOKEN>/setWebhook?url=<APP_URL>/api/telegram/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
 *
 * Access control is the admin chat-id allowlist (TELEGRAM_ADMIN_CHAT_ID) —
 * every command from any other chat is silently ignored. This is not a
 * backdoor: there is exactly one allowed identity, it is numeric (never a
 * phone number), and every command it can issue is read-only.
 */
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isValidWebhookSecret, isAdminChat, sendTelegramMessage } from '@/lib/telegram-ops/telegram-provider';
import { COMMANDS as OPS_COMMANDS } from '@/lib/telegram-ops/commands';
import { commandAudit, commandScores, commandIssues, commandRecommendations, commandEvidence, commandReport } from '@/lib/telegram-ops/audit-commands';

const COMMANDS: Record<string, (args: string[]) => Promise<string>> = {
  ...OPS_COMMANDS,
  '/audit': commandAudit,
  '/scores': commandScores,
  '/issues': commandIssues,
  '/recommendations': commandRecommendations,
  '/evidence': commandEvidence,
  '/report': commandReport,
};

interface TelegramUpdate {
  message?: {
    chat?: { id?: number | string };
    text?: string;
  };
}

const HELP_TEXT = [
  '<b>SiteNexis Ops</b>',
  'Available commands:',
  ...Object.keys(COMMANDS).map((c) => c),
].join('\n');

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (!isValidWebhookSecret(secretHeader)) {
    logger.warn('Telegram webhook: invalid or missing secret token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  const chatId = update.message?.chat?.id;
  const text = update.message?.text?.trim();

  if (chatId == null || !text) {
    return NextResponse.json({ ok: true });
  }

  if (!isAdminChat(chatId)) {
    logger.warn({ chatId: String(chatId) }, 'Telegram webhook: command from non-admin chat ignored');
    return NextResponse.json({ ok: true });
  }

  // Strip an @BotName suffix (group-chat command form); everything after the
  // command word is passed through as args (e.g. "/audit example.com").
  const parts = text.split(/\s+/);
  const commandKey = parts[0]?.replace(/@\w+$/, '') ?? '';
  const args = parts.slice(1);
  const handler = COMMANDS[commandKey];

  try {
    const reply = handler ? await handler(args) : HELP_TEXT;
    const sent = await sendTelegramMessage(String(chatId), reply);
    if (!sent) {
      // Authorization and dispatch both succeeded, but delivery back to Telegram
      // failed — this is the one failure mode the webhook route previously
      // swallowed entirely, producing a "no reply, no error anywhere" symptom.
      logger.error({ commandKey }, 'Telegram webhook: sendMessage failed after successful authorization and dispatch');
    }
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), commandKey }, 'Telegram command handler failed');
    const sent = await sendTelegramMessage(String(chatId), '⚠️ Command failed — check server logs.');
    if (!sent) {
      logger.error({ commandKey }, 'Telegram webhook: failure-notice sendMessage also failed');
    }
  }

  return NextResponse.json({ ok: true });
}
