/**
 * SiteNexis User Assistant — command handlers (T1-T6).
 *
 * /audit, /addsite, and the "Run Audit" confirmation callback all funnel
 * into the SAME startAuditForUser() used by the dashboard's
 * POST /api/audit/start — there is no Telegram-specific audit logic here.
 *
 * This file owns account/identity/menu/settings commands and their
 * callbacks. Intelligence reads live in intelligence-commands.ts, Scout
 * lives in scout-command.ts — the webhook route composes all three, plus
 * the `mnu:`/`int:` navigation callbacks, since routing between them is an
 * orchestration concern that belongs at the delivery layer, not duplicated
 * inside any single command module.
 */
import { escapeHtml as escapeHtmlShared } from '@/lib/telegram-ops/commands';
import { env } from '@/lib/env';
import type { InlineKeyboard } from '@/lib/telegram-user/provider';
import {
  CB,
  START_UNLINKED_KEYBOARD,
  START_LINKED_NO_DOMAIN_KEYBOARD,
  START_LINKED_ACTIVE_DOMAIN_KEYBOARD,
  SETTINGS_MENU_KEYBOARD,
  DISCONNECT_CONFIRM_KEYBOARD,
  notificationsKeyboard,
  NOTIF_TOGGLE_FIELD,
  type NotificationPrefsForKeyboard,
} from '@/lib/telegram-user/keyboards';

export function escapeHtml(value: string): string {
  return escapeHtmlShared(value);
}

const HELP_TEXT = [
  '<b>SiteNexis Assistant</b>',
  'Your AI Visibility & Machine Trust Intelligence assistant.',
  '',
  'Account:',
  '/start — connect or check your connection',
  '/menu — main menu',
  '/account — your linked SiteNexis account',
  '/usage — plan, credits, audits this month',
  '/settings — notifications, account, disconnect',
  '/notifications — choose which audit results message you',
  '/disconnect — unlink this Telegram account',
  '/websites — list your SiteNexis websites',
  '/select &lt;domain&gt; — set your active website',
  '',
  'Audits:',
  '/audit [domain] — run an audit (uses your active website if omitted)',
  '/addsite &lt;domain&gt; — audit and add a new website',
  '/status [domain] — latest audit status',
  '/history [page] — your audit history',
  '/monitor — score trend + open/resolved issues for your active website',
  '',
  'Intelligence (uses your active website):',
  '/scores — full canonical scorecard',
  '/aivisibility — AI Visibility tier',
  '/retrieval — Retrieval Readiness',
  '/machinetrust — Machine Trust',
  '/citation — Citation Probability',
  '/entity — Entity Intelligence',
  '/seo — Technical SEO',
  '/schema — Schema coverage',
  '/performance — Performance score',
  '/links — Link Graph strength',
  '/issues — all issues by severity',
  '/critical — critical issues only',
  '/fixplan — prioritized fix plan',
  '/report — full Intelligence Report',
  '/compare — diff your latest two completed audits',
  '/scout &lt;question&gt; — ask Scout about your audit (e.g. "What should I fix first?")',
  '',
  'Other:',
  '/alerts — what SiteNexis can alert you about',
  '/about — what SiteNexis is',
  '/privacy — privacy policy',
  '/support — get help',
  '/help — this message',
].join('\n');

const CALLBACK_SELECT_PREFIX = CB.SELECT;
const CALLBACK_AUDIT_RUN_PREFIX = CB.AUDIT_RUN;
const CALLBACK_AUDIT_CANCEL = CB.AUDIT_CANCEL;

export interface CommandReply {
  text: string;
  keyboard?: InlineKeyboard;
}

// ─── Identity / linking ─────────────────────────────────────────────────────

async function touchInteraction(telegramUserId: string): Promise<void> {
  const { touchLastInteraction } = await import('@sitenexis/db');
  await touchLastInteraction(telegramUserId);
}

async function requireLinkedConnection(telegramUserId: string) {
  const { getConnectionByTelegramUserId } = await import('@sitenexis/db');
  const connection = await getConnectionByTelegramUserId(telegramUserId);
  if (!connection || connection.status !== 'linked') return null;
  return connection;
}

/** Generates a fresh single-use linking token and returns the link text. Used by both /start's first-touch flow (via the "Connect SiteNexis" button) and directly if a still-unlinked user re-sends /start. */
export async function commandConnect(telegramUserId: string, telegramChatId: string): Promise<string> {
  const { startTelegramLink } = await import('@/lib/telegram-user/account-linking');
  const { linkUrl } = await startTelegramLink(telegramUserId, telegramChatId);
  return [
    '<b>Connect your SiteNexis account</b>',
    'Tap the link below, sign in to SiteNexis, and confirm the connection.',
    'This link expires in about 10 minutes and can only be used once.',
    '',
    linkUrl,
  ].join('\n');
}

/**
 * /start — state-aware entry point. Unlike the old single-branch version,
 * this never generates a link token unless the user actually taps "Connect
 * SiteNexis" (via commandConnect) — a token generated on every /start
 * message a user hasn't acted on yet would just expire unused.
 */
export async function commandStart(telegramUserId: string, telegramChatId: string): Promise<CommandReply> {
  void telegramChatId; // kept in the signature for callers that pass it; token generation now happens in commandConnect
  const { getConnectionByTelegramUserId } = await import('@sitenexis/db');
  const existing = await getConnectionByTelegramUserId(telegramUserId);

  if (existing?.status === 'linked') {
    await touchInteraction(telegramUserId);
    if (!existing.activeDomain) {
      return {
        text: ['<b>Welcome back to SiteNexis</b>', 'No active website selected yet.'].join('\n'),
        keyboard: START_LINKED_NO_DOMAIN_KEYBOARD,
      };
    }
    return {
      text: ['<b>Welcome back to SiteNexis</b>', `Active website: <b>${escapeHtml(existing.activeDomain)}</b>`].join('\n'),
      keyboard: START_LINKED_ACTIVE_DOMAIN_KEYBOARD,
    };
  }

  return {
    text: [
      '<b>Welcome to SiteNexis</b>',
      'SiteNexis models how AI systems like ChatGPT, Perplexity, and Google AI Overviews retrieve, trust, and recommend your website, then shows you exactly what to fix.',
      '',
      'Connect your SiteNexis account to get started.',
    ].join('\n'),
    keyboard: START_UNLINKED_KEYBOARD,
  };
}

/** /menu — the full main menu, only meaningful for a linked user. */
export async function commandMenu(telegramUserId: string): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) {
    return { text: 'Not connected. Send /start to link your SiteNexis account.', keyboard: START_UNLINKED_KEYBOARD };
  }
  if (!connection.activeDomain) {
    return { text: '<b>Menu</b>\nSelect a website to get started.', keyboard: START_LINKED_NO_DOMAIN_KEYBOARD };
  }
  return { text: `<b>Menu</b> — ${escapeHtml(connection.activeDomain)}`, keyboard: START_LINKED_ACTIVE_DOMAIN_KEYBOARD };
}

export async function commandAccount(telegramUserId: string): Promise<string> {
  await touchInteraction(telegramUserId);
  const { getConnectionByTelegramUserId } = await import('@sitenexis/db');
  const connection = await getConnectionByTelegramUserId(telegramUserId);

  if (!connection || connection.status !== 'linked') {
    return 'Not connected. Send /start to link your SiteNexis account.';
  }

  const lines = [
    '<b>Your SiteNexis account</b>',
    'Status: Connected',
    `Linked since: ${connection.linkedAt.toISOString().slice(0, 10)}`,
    connection.activeDomain ? `Active website: ${escapeHtml(connection.activeDomain)}` : 'Active website: none selected yet',
  ];

  // Website count is best-effort — /account must never fail just because
  // this one extra lookup did.
  try {
    const { getUserWebsiteDomains } = await import('@sitenexis/db');
    const websites = await getUserWebsiteDomains(connection.siteNexisUserId);
    lines.push(`Websites: ${websites.length}`);
  } catch { /* omit the line rather than fail /account */ }

  lines.push('', 'Send /usage for plan and credit details, or /settings to manage notifications and disconnect.');
  return lines.join('\n');
}

/** /disconnect — now a two-step confirmation; the actual disconnect happens in handleDisconnectCallback. */
export async function commandDisconnect(telegramUserId: string): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected — nothing to disconnect.' };
  return { text: 'Disconnect SiteNexis?', keyboard: DISCONNECT_CONFIRM_KEYBOARD };
}

/** Callback for the Confirm Disconnect / Cancel keyboard. Re-resolves identity from callback_query.from.id, same pattern as every other callback here. */
export async function handleDisconnectCallback(telegramUserId: string, callbackData: string): Promise<string | null> {
  if (callbackData === CB.DISCONNECT_CANCEL) return 'Cancelled.';
  if (callbackData !== CB.DISCONNECT_CONFIRM) return null;

  const { getConnectionByTelegramUserId, disconnectConnection } = await import('@sitenexis/db');
  const connection = await getConnectionByTelegramUserId(telegramUserId);
  if (!connection || connection.status !== 'linked') return 'Not connected — nothing to disconnect.';

  await disconnectConnection(connection.siteNexisUserId);
  return 'Disconnected. Send /start any time to link a SiteNexis account again.';
}

export async function commandHelp(): Promise<string> {
  return HELP_TEXT;
}

export async function commandAbout(): Promise<string> {
  return [
    '<b>About SiteNexis</b>',
    'SiteNexis is an AI Retrieval and Machine Trust Intelligence platform. It audits how AI systems (ChatGPT, Perplexity, Google AI Overviews, Gemini, Claude, and others) retrieve, interpret, trust, and recommend a website, then produces a prioritized plan to fix what is blocking that process.',
    '',
    `Full platform: ${env.NEXT_PUBLIC_APP_URL}`,
  ].join('\n');
}

export async function commandPrivacy(): Promise<string> {
  return [
    '<b>Privacy</b>',
    'SiteNexis only accesses your own linked account and audit history. This bot never reads or exposes another user\'s data, and never shares Google Analytics or Search Console data through Telegram.',
    '',
    `Full privacy policy: ${env.NEXT_PUBLIC_APP_URL}/privacy`,
  ].join('\n');
}

export async function commandSupport(): Promise<string> {
  return [
    '<b>Support</b>',
    'Something not working, or have a question?',
    '',
    `Contact SiteNexis: ${env.NEXT_PUBLIC_APP_URL}/contact`,
  ].join('\n');
}

/**
 * /alerts — truthful by design. There is no separate background alerting
 * system beyond audit-result notifications; this never invents monitoring
 * that doesn't exist.
 */
export async function commandAlerts(telegramUserId: string): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';
  return [
    '<b>Alerts</b>',
    'SiteNexis does not run a separate background alerting system today. The only alerts available are audit-result notifications, sent to this chat as they happen: complete, partial, and failed.',
    '',
    'Send /notifications to control which of those you receive.',
  ].join('\n');
}

/**
 * /monitor — reuses the SAME canonical score-history state (loop-os
 * getSiteState) the dashboard's Score Monitoring page reads. No score,
 * trend, or issue count is computed here.
 */
export async function commandMonitor(telegramUserId: string): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';
  const domain = connection.activeDomain;
  if (!domain) return 'No active website selected. Send /select <domain> first, or /websites to see your options.';
  await touchInteraction(telegramUserId);

  try {
    const { getSiteState } = await import('@sitenexis/loop-os');
    const state = await getSiteState(domain);
    if (!state || state.scoreHistory.length === 0) {
      return [`<b>Monitoring</b> — ${escapeHtml(domain)}`, 'No score history recorded yet. This builds up after your first completed audit.'].join('\n');
    }

    const history = state.scoreHistory;
    const latest = history[history.length - 1]!;
    const prev = history.length > 1 ? history[history.length - 2]! : null;
    const delta = prev ? latest.overall - prev.overall : null;

    const lines = [
      `<b>Monitoring</b> — ${escapeHtml(domain)}`,
      `Overall score: ${Math.round(latest.overall)}${delta !== null ? ` (${delta >= 0 ? '+' : ''}${Math.round(delta)} vs previous audit)` : ''}`,
      `Open issues: ${state.openIssues.length}`,
      `Resolved issues: ${state.resolvedIssues.length}`,
    ];
    if (state.lastAuditCompletedAt) {
      lines.push(`Last audit: ${new Date(state.lastAuditCompletedAt).toISOString().slice(0, 19).replace('T', ' ')}`);
    }
    lines.push('', 'Send /notifications to control what triggers a message from SiteNexis.');
    return lines.join('\n');
  } catch {
    return `<b>Monitoring</b> — ${escapeHtml(domain)}\nCould not load monitoring data right now.`;
  }
}

/** /usage — mirrors GET /api/usage exactly; never calculates billing/plan state independently. */
export async function commandUsage(telegramUserId: string): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';
  await touchInteraction(telegramUserId);

  try {
    const { getUserById, countAuditsThisMonth, getUserCredits } = await import('@sitenexis/db');
    const { PLAN_LIMITS } = await import('@sitenexis/shared');
    const [dbUser, credits, auditsUsed] = await Promise.all([
      getUserById(connection.siteNexisUserId),
      getUserCredits(connection.siteNexisUserId),
      countAuditsThisMonth(connection.siteNexisUserId),
    ]);

    const plan = (dbUser?.plan ?? 'free') as keyof typeof PLAN_LIMITS;
    const limits = PLAN_LIMITS[plan];
    const isUnlimitedAudits = limits.auditsPerMonth === -1;

    return [
      '<b>Usage & Plan</b>',
      `Plan: ${escapeHtml(plan)}`,
      isUnlimitedAudits ? `Audits this month: ${auditsUsed} (unlimited)` : `Audits this month: ${auditsUsed} / ${limits.auditsPerMonth}`,
      credits.isUnlimited ? 'Credit balance: unlimited' : `Credit balance: ${credits.balance}`,
      `Layer 4 analysis (Machine Trust, Retrieval Simulation, Temporal Authority, Surfaces, Authenticity): ${limits.layer4Analysis ? 'included in your plan' : 'not on your plan'}`,
      `Competitive analysis: ${limits.competitiveAnalysis ? 'included in your plan' : 'not on your plan'}`,
    ].join('\n');
  } catch {
    return '<b>Usage & Plan</b>\nCould not load your usage right now. Try again shortly.';
  }
}

function currentPrefs(pref: NotificationPrefsForKeyboard | null): NotificationPrefsForKeyboard {
  return {
    notifyOnComplete: pref?.notifyOnComplete ?? true,
    notifyOnPartial: pref?.notifyOnPartial ?? true,
    notifyOnFailed: pref?.notifyOnFailed ?? true,
  };
}

/** /notifications and Settings > Notifications both land here. */
export async function commandNotifications(telegramUserId: string): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };
  await touchInteraction(telegramUserId);

  const { getNotificationPreference } = await import('@sitenexis/db');
  const pref = await getNotificationPreference(connection.id);
  return { text: '<b>Notifications</b>\nTap to toggle which audit results message you.', keyboard: notificationsKeyboard(currentPrefs(pref)) };
}

/** Callback for the Notifications toggle keyboard — flips one field and redraws the same keyboard with the new state. */
export async function handleNotificationToggleCallback(telegramUserId: string, callbackData: string): Promise<CommandReply | null> {
  if (!callbackData.startsWith(CB.NOTIF_TOGGLE)) return null;
  const field = NOTIF_TOGGLE_FIELD[callbackData.slice(CB.NOTIF_TOGGLE.length)];
  if (!field) return null;

  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };

  const { getNotificationPreference, updateNotificationPreference } = await import('@sitenexis/db');
  const pref = await getNotificationPreference(connection.id);
  const current = currentPrefs(pref);
  const updated: NotificationPrefsForKeyboard = { ...current, [field]: !current[field] };
  await updateNotificationPreference(connection.id, { [field]: updated[field] });

  return { text: '<b>Notifications</b>\nTap to toggle which audit results message you.', keyboard: notificationsKeyboard(updated) };
}

/** /settings — a small menu over already-existing account/notification/disconnect functionality. */
export async function commandSettings(telegramUserId: string): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };
  return { text: '<b>Settings</b>\nChoose what to manage.', keyboard: SETTINGS_MENU_KEYBOARD };
}

/** Callback for the Settings menu — routes to the same command functions /notifications, /account, /disconnect already use. */
export async function handleSettingsCallback(telegramUserId: string, callbackData: string): Promise<CommandReply | null> {
  if (!callbackData.startsWith(CB.SETTINGS)) return null;
  const key = callbackData.slice(CB.SETTINGS.length);
  if (key === 'notif') return commandNotifications(telegramUserId);
  if (key === 'account') return { text: await commandAccount(telegramUserId) };
  if (key === 'disconnect') return commandDisconnect(telegramUserId);
  return null;
}

// ─── Websites ───────────────────────────────────────────────────────────────

function websiteButtonRow(domain: string): InlineKeyboard[number] | null {
  const data = `${CALLBACK_SELECT_PREFIX}${domain}`;
  // Telegram hard-limits callback_data to 64 bytes — a domain that would
  // overflow it is simply omitted from the keyboard (still reachable via
  // the text-based /select <domain> command).
  if (Buffer.byteLength(data, 'utf8') > 64) return null;
  return [{ text: domain, callback_data: data }];
}

export async function commandWebsites(telegramUserId: string): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };
  await touchInteraction(telegramUserId);

  const { getUserWebsiteDomains } = await import('@sitenexis/db');
  const websites = await getUserWebsiteDomains(connection.siteNexisUserId);

  if (websites.length === 0) {
    return { text: 'No websites yet. Run an audit from the SiteNexis dashboard to add one — /addsite for details.' };
  }

  const lines = [
    '<b>Your websites</b>',
    ...websites.map((w) => `${w.domain === connection.activeDomain ? '● ' : '— '}${escapeHtml(w.domain)} (${escapeHtml(w.latestStatus)})`),
    '',
    'Tap a website below, or use /select <domain>.',
  ];
  const keyboard = websites.map((w) => websiteButtonRow(w.domain)).filter((row): row is InlineKeyboard[number] => row !== null);

  return { text: lines.join('\n'), keyboard };
}

async function selectDomainForUser(telegramUserId: string, requestedDomain: string): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';

  const { getUserWebsiteDomains, setActiveDomain } = await import('@sitenexis/db');
  const websites = await getUserWebsiteDomains(connection.siteNexisUserId);
  const match = websites.find((w) => w.domain.toLowerCase() === requestedDomain.toLowerCase());

  if (!match) {
    return `"${escapeHtml(requestedDomain)}" isn't in your SiteNexis account. Send /websites to see your options.`;
  }

  await setActiveDomain(telegramUserId, match.domain);
  return `Active website set to ${escapeHtml(match.domain)}.`;
}

export async function commandSelect(telegramUserId: string, args: string[]): Promise<string> {
  const requested = args.join(' ').trim();
  if (!requested) return 'Usage: /select <domain>. Send /websites to see your options.';
  return selectDomainForUser(telegramUserId, requested);
}

/**
 * Callback-query handler for the /websites inline keyboard. Ownership is
 * re-verified from scratch here using the Telegram user ID Telegram itself
 * attaches to the callback (callback_query.from.id) — the callback_data
 * payload is never trusted as proof of ownership on its own.
 */
export async function handleWebsiteSelectCallback(telegramUserId: string, callbackData: string): Promise<string | null> {
  if (!callbackData.startsWith(CALLBACK_SELECT_PREFIX)) return null;
  const domain = callbackData.slice(CALLBACK_SELECT_PREFIX.length);
  return selectDomainForUser(telegramUserId, domain);
}

// ─── Audits ─────────────────────────────────────────────────────────────────

function auditConfirmKeyboard(domain: string): InlineKeyboard | null {
  const runData = `${CALLBACK_AUDIT_RUN_PREFIX}${domain}`;
  // Telegram hard-limits callback_data to 64 bytes — see websiteButtonRow above.
  if (Buffer.byteLength(runData, 'utf8') > 64) return null;
  return [[{ text: 'Run Audit', callback_data: runData }, { text: 'Cancel', callback_data: CALLBACK_AUDIT_CANCEL }]];
}

/**
 * Validates the domain (format + SSRF only — no credit/quota/duplicate
 * checks yet, those are deferred to confirm-time so an unconfirmed request
 * never touches credits) and returns an inline "Run Audit / Cancel"
 * confirmation. Shared by /audit and /addsite — the only difference between
 * the two commands is their usage-error text.
 */
async function buildAuditConfirmation(requestedDomain: string): Promise<CommandReply> {
  const { normalizeAndValidateDomain } = await import('@/lib/audit-orchestration');
  const result = normalizeAndValidateDomain(requestedDomain);
  if (!result.ok) {
    return {
      text: result.reason === 'private_or_reserved'
        ? 'Private or reserved domains are not allowed.'
        : "That doesn't look like a valid domain. Example: example.com",
    };
  }

  const keyboard = auditConfirmKeyboard(result.domain);
  if (!keyboard) {
    return { text: `"${escapeHtml(result.domain)}" is too long to confirm inline. Try a shorter domain.` };
  }

  return { text: `Audit ${escapeHtml(result.domain)}?`, keyboard };
}

export async function commandAudit(telegramUserId: string, args: string[]): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };
  await touchInteraction(telegramUserId);

  const requested = args.join(' ').trim() || connection.activeDomain;
  if (!requested) {
    return { text: 'Usage: /audit <domain>. Or /select a website first, then send /audit with no domain to re-audit it.' };
  }
  return buildAuditConfirmation(requested);
}

export async function commandAddSite(telegramUserId: string, args: string[]): Promise<CommandReply> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return { text: 'Not connected. Send /start to link your SiteNexis account.' };
  await touchInteraction(telegramUserId);

  const requested = args.join(' ').trim();
  if (!requested) {
    return { text: 'Usage: /addsite <domain> — starts an audit for a new website and adds it to your account once it completes.' };
  }
  return buildAuditConfirmation(requested);
}

/**
 * Callback-query handler for the /audit and /addsite "Run Audit / Cancel"
 * inline keyboard. Ownership is re-resolved from callback_query.from.id
 * (Telegram-verified), same pattern as handleWebsiteSelectCallback — the
 * domain embedded in callback_data is treated as a value to audit, not a
 * proof of ownership (any domain can be audited, same as the dashboard's
 * "add a website" flow).
 *
 * Idempotency: a redelivered Run Audit tap is naturally safe — it re-enters
 * startAuditForUser(), whose own duplicate-running-audit check (see
 * audit-orchestration.ts) returns a truthful "already running" message on
 * the second delivery instead of starting or billing a second audit.
 */
export async function handleAuditConfirmCallback(telegramUserId: string, callbackData: string): Promise<string | null> {
  if (callbackData === CALLBACK_AUDIT_CANCEL) return 'Cancelled.';
  if (!callbackData.startsWith(CALLBACK_AUDIT_RUN_PREFIX)) return null;

  const domain = callbackData.slice(CALLBACK_AUDIT_RUN_PREFIX.length);
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';

  const { getUserById } = await import('@sitenexis/db');
  const user = await getUserById(connection.siteNexisUserId);
  if (!user) return 'Your SiteNexis account could not be found. Please contact support.';

  const { startAuditForUser } = await import('@/lib/audit-orchestration');
  const result = await startAuditForUser(connection.siteNexisUserId, user.email, domain);

  if (!result.ok) return result.message;

  return [
    `Audit started for ${escapeHtml(result.domain)}.`,
    `Mode: ${result.executionMode === 'bullmq' ? 'background worker' : 'serverless'}.`,
    'Send /status to check progress.',
  ].join('\n');
}

export async function commandStatus(telegramUserId: string, args: string[]): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';
  await touchInteraction(telegramUserId);

  const requested = (args.join(' ').trim() || connection.activeDomain || '').toLowerCase();
  if (!requested) {
    return 'No active website selected. Send /select <domain> first, or /status <domain>.';
  }

  const { getLatestAuditByDomain } = await import('@sitenexis/db');
  const audit = await getLatestAuditByDomain(requested, connection.siteNexisUserId);
  if (!audit) {
    return `No audits found for ${escapeHtml(requested)}. Send /audit ${escapeHtml(requested)} to start one.`;
  }

  const lines = [
    `<b>${escapeHtml(audit.domain)}</b>`,
    `Status: ${escapeHtml(audit.status)}`,
    `Started: ${audit.createdAt.toISOString().slice(0, 19).replace('T', ' ')}`,
  ];
  if (audit.completedAt) {
    lines.push(`Completed: ${audit.completedAt.toISOString().slice(0, 19).replace('T', ' ')}`);
  }
  if (audit.status === 'failed' && audit.errorMessage) {
    lines.push(`Error: ${escapeHtml(audit.errorMessage.slice(0, 200))}`);
  }
  if (audit.status === 'complete' || audit.status === 'partial') {
    lines.push('', 'Send /report for the full intelligence report.');
  }
  return lines.join('\n');
}

export async function commandHistory(telegramUserId: string, args: string[]): Promise<string> {
  const connection = await requireLinkedConnection(telegramUserId);
  if (!connection) return 'Not connected. Send /start to link your SiteNexis account.';
  await touchInteraction(telegramUserId);

  const pageArg = parseInt(args[0] ?? '1', 10);
  const page = Number.isFinite(pageArg) && pageArg > 0 ? pageArg : 1;
  const pageSize = 10;

  const { listAuditsByUser } = await import('@sitenexis/db');
  const { data, total } = await listAuditsByUser(connection.siteNexisUserId, page, pageSize);

  if (data.length === 0) {
    return page === 1
      ? 'No audits yet. Send /audit <domain> to run your first one.'
      : `No audits on page ${page}.`;
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const lines = [
    `<b>Your audits</b> (page ${page} of ${totalPages})`,
    ...data.map((a) => `${escapeHtml(a.domain)} — ${escapeHtml(a.status)} — ${a.createdAt.toISOString().slice(0, 10)}`),
  ];
  if (page < totalPages) lines.push('', `Send /history ${page + 1} for more.`);
  return lines.join('\n');
}

/** Commands named in the full product spec that are still not implemented — never advertised as available, only shown truthfully if explicitly asked for. */
export const UNIMPLEMENTED_COMMANDS = new Set(['/quickaudit']);

export function unimplementedReply(command: string): string {
  return `"${escapeHtml(command)}" is not available yet in this release. Send /help to see what's available now.`;
}
