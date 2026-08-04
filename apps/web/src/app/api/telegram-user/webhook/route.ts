export const dynamic = 'force-dynamic';
/**
 * SiteNexis User Assistant webhook — the authenticated, multi-user customer
 * bot. Fully separate from /api/telegram/webhook (the admin Ops console):
 * different token, different webhook secret, different identity model.
 *
 * V1 is private-chat only — group/supergroup/channel updates are politely
 * declined, never processed, to avoid the privacy and authorization
 * complexity of multi-party chats.
 *
 * This route is the ONLY place `mnu:`/`int:` callback keys are resolved to a
 * command function — every menu/submenu button reuses the exact same
 * command handler its equivalent text command uses, so there is exactly one
 * implementation of every piece of business logic regardless of how the
 * user reached it (typed command, main menu, or a notification button).
 */
import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { isValidUserBotWebhookSecret, sendUserBotMessage, answerCallbackQuery } from '@/lib/telegram-user/provider';
import {
  commandStart, commandMenu, commandAccount, commandDisconnect, handleDisconnectCallback, commandHelp,
  commandAbout, commandPrivacy, commandSupport, commandAlerts, commandMonitor, commandUsage,
  commandNotifications, handleNotificationToggleCallback, commandSettings, handleSettingsCallback,
  commandConnect,
  commandWebsites, commandSelect, commandAddSite,
  commandAudit, commandStatus, commandHistory,
  handleWebsiteSelectCallback, handleAuditConfirmCallback,
  UNIMPLEMENTED_COMMANDS, unimplementedReply,
  type CommandReply,
} from '@/lib/telegram-user/commands';
import {
  commandScores, commandAiVisibility, commandRetrieval, commandMachineTrust,
  commandCitation, commandEntity, commandSeo, commandSchema, commandPerformance,
  commandLinks, commandIssues, commandCritical, commandFixplan, commandReport,
  commandCompare,
} from '@/lib/telegram-user/intelligence-commands';
import { commandScout } from '@/lib/telegram-user/scout-command';
import { CB, INTELLIGENCE_MENU_KEYBOARD } from '@/lib/telegram-user/keyboards';
import { chunkTelegramMessage } from '@/lib/telegram-user/message-chunking';

interface TelegramUpdate {
  message?: {
    from?: { id?: number };
    chat?: { id?: number | string; type?: string };
    text?: string;
  };
  callback_query?: {
    id?: string;
    from?: { id?: number };
    message?: { chat?: { id?: number | string; type?: string } };
    data?: string;
  };
}

const COMMANDS: Record<string, (telegramUserId: string, telegramChatId: string, args: string[]) => Promise<string | CommandReply>> = {
  '/start': (uid, chatId) => commandStart(uid, chatId),
  '/menu': (uid) => commandMenu(uid),
  '/account': (uid) => commandAccount(uid),
  '/usage': (uid) => commandUsage(uid),
  '/settings': (uid) => commandSettings(uid),
  '/notifications': (uid) => commandNotifications(uid),
  '/disconnect': (uid) => commandDisconnect(uid),
  '/help': () => commandHelp(),
  '/about': () => commandAbout(),
  '/privacy': () => commandPrivacy(),
  '/support': () => commandSupport(),
  '/alerts': (uid) => commandAlerts(uid),
  '/monitor': (uid) => commandMonitor(uid),
  '/websites': (uid) => commandWebsites(uid),
  '/select': (uid, _chatId, args) => commandSelect(uid, args),
  '/audit': (uid, _chatId, args) => commandAudit(uid, args),
  '/addsite': (uid, _chatId, args) => commandAddSite(uid, args),
  '/status': (uid, _chatId, args) => commandStatus(uid, args),
  '/history': (uid, _chatId, args) => commandHistory(uid, args),
  '/scores': (uid) => commandScores(uid),
  '/aivisibility': (uid) => commandAiVisibility(uid),
  '/retrieval': (uid) => commandRetrieval(uid),
  '/machinetrust': (uid) => commandMachineTrust(uid),
  '/citation': (uid) => commandCitation(uid),
  '/entity': (uid) => commandEntity(uid),
  '/seo': (uid) => commandSeo(uid),
  '/schema': (uid) => commandSchema(uid),
  '/performance': (uid) => commandPerformance(uid),
  '/links': (uid) => commandLinks(uid),
  '/issues': (uid) => commandIssues(uid),
  '/critical': (uid) => commandCritical(uid),
  '/fixplan': (uid) => commandFixplan(uid),
  '/report': (uid) => commandReport(uid),
  '/compare': (uid) => commandCompare(uid),
  '/scout': (uid, _chatId, args) => commandScout(uid, args),
};

/** Backs both the `/scores` etc. text commands (via COMMANDS above) and the `int:` intelligence-submenu callback — one function per command, never duplicated. */
const INTEL_DISPATCH: Record<string, (telegramUserId: string) => Promise<string>> = {
  scores: commandScores,
  aivisibility: commandAiVisibility,
  retrieval: commandRetrieval,
  machinetrust: commandMachineTrust,
  citation: commandCitation,
  entity: commandEntity,
  seo: commandSeo,
  schema: commandSchema,
  performance: commandPerformance,
  links: commandLinks,
  issues: commandIssues,
  critical: commandCritical,
  fixplan: commandFixplan,
  compare: commandCompare,
};

async function handleMenuCallback(telegramUserId: string, telegramChatId: string, key: string): Promise<string | CommandReply | null> {
  switch (key) {
    case 'connect': return { text: await commandConnect(telegramUserId, telegramChatId) };
    case 'help': return { text: await commandHelp() };
    case 'privacy': return { text: await commandPrivacy() };
    case 'sites': return commandWebsites(telegramUserId);
    case 'account': return { text: await commandAccount(telegramUserId) };
    case 'audit': return commandAudit(telegramUserId, []);
    case 'intel': return { text: '<b>Intelligence</b>\nChoose a report.', keyboard: INTELLIGENCE_MENU_KEYBOARD };
    case 'report': return { text: await commandReport(telegramUserId) };
    case 'scout': return { text: await commandScout(telegramUserId, []) };
    case 'settings': return commandSettings(telegramUserId);
    case 'notifications': return commandNotifications(telegramUserId);
    default: return null;
  }
}

async function sendReply(chatId: string, reply: string | CommandReply): Promise<void> {
  const { text, keyboard } = typeof reply === 'string' ? { text: reply, keyboard: undefined } : reply;
  const chunks = chunkTelegramMessage(text);

  for (let i = 0; i < chunks.length; i++) {
    const isLast = i === chunks.length - 1;
    const pageSuffix = chunks.length > 1 ? `\n\n<i>(${i + 1}/${chunks.length})</i>` : '';
    const sent = await sendUserBotMessage(
      chatId,
      chunks[i] + pageSuffix,
      isLast && keyboard ? { inline_keyboard: keyboard } : undefined,
    );
    if (!sent) {
      logger.error({ chunk: i + 1, of: chunks.length }, 'Telegram user-bot webhook: sendMessage failed after successful dispatch');
      break;
    }
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  if (!isValidUserBotWebhookSecret(secretHeader)) {
    logger.warn('Telegram user-bot webhook: invalid or missing secret token');
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let update: TelegramUpdate;
  try {
    update = await req.json() as TelegramUpdate;
  } catch {
    return NextResponse.json({ ok: true });
  }

  if (update.callback_query) return handleCallbackQuery(update.callback_query);

  const chat = update.message?.chat;
  const fromId = update.message?.from?.id;
  const text = update.message?.text?.trim();

  if (chat == null || fromId == null || !text) {
    return NextResponse.json({ ok: true });
  }

  if (chat.type !== 'private') {
    // Never process group/supergroup/channel updates in v1 — decline once, politely.
    if (chat.id != null) {
      await sendUserBotMessage(String(chat.id), 'The SiteNexis Assistant only works in a private chat. Message the bot directly.');
    }
    return NextResponse.json({ ok: true });
  }

  const telegramUserId = String(fromId);
  const telegramChatId = String(chat.id);

  const parts = text.split(/\s+/);
  const commandKey = (parts[0]?.replace(/@\w+$/, '') ?? '').toLowerCase();
  const args = parts.slice(1);
  const handler = COMMANDS[commandKey];

  try {
    const reply = handler
      ? await handler(telegramUserId, telegramChatId, args)
      : UNIMPLEMENTED_COMMANDS.has(commandKey)
      ? unimplementedReply(commandKey)
      : await commandHelp();

    await sendReply(telegramChatId, reply);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err), commandKey }, 'Telegram user-bot command handler failed');
    await sendUserBotMessage(telegramChatId, 'Something went wrong. Please try again in a moment.');
  }

  return NextResponse.json({ ok: true });
}

/**
 * Ownership is derived exclusively from callback_query.from.id — the
 * Telegram-verified identity of whoever tapped the button — never from
 * anything embedded in callback_query.data itself. See
 * handleWebsiteSelectCallback for the second layer of re-validation
 * (the selected domain must belong to *this* caller's own website list).
 *
 * callback_query.id is always answered (success or failure) so Telegram
 * stops showing the loading spinner on the tapped button, even if the
 * underlying handler throws.
 */
async function handleCallbackQuery(callback: NonNullable<TelegramUpdate['callback_query']>): Promise<NextResponse> {
  const callbackId = callback.id;
  const fromId = callback.from?.id;
  const chat = callback.message?.chat;
  const data = callback.data;

  if (!callbackId || fromId == null || chat?.id == null || !data) {
    return NextResponse.json({ ok: true });
  }

  if (chat.type !== 'private') {
    await answerCallbackQuery(callbackId, 'Private chat only.');
    return NextResponse.json({ ok: true });
  }

  const telegramUserId = String(fromId);
  const telegramChatId = String(chat.id);

  try {
    const intelKey = data.startsWith(CB.INTEL) ? data.slice(CB.INTEL.length) : null;
    const intelFn = intelKey ? INTEL_DISPATCH[intelKey] : undefined;

    const reply: string | CommandReply | null =
      (await handleWebsiteSelectCallback(telegramUserId, data))
      ?? (await handleAuditConfirmCallback(telegramUserId, data))
      ?? (await handleNotificationToggleCallback(telegramUserId, data))
      ?? (await handleSettingsCallback(telegramUserId, data))
      ?? (await handleDisconnectCallback(telegramUserId, data))
      ?? (intelFn ? { text: await intelFn(telegramUserId) } : null)
      ?? (data.startsWith(CB.MENU) ? await handleMenuCallback(telegramUserId, telegramChatId, data.slice(CB.MENU.length)) : null);

    await answerCallbackQuery(callbackId);
    if (reply) await sendReply(telegramChatId, reply);
  } catch (err) {
    logger.error({ err: err instanceof Error ? err.message : String(err) }, 'Telegram user-bot callback handler failed');
    await answerCallbackQuery(callbackId, 'Something went wrong.');
  }

  return NextResponse.json({ ok: true });
}
