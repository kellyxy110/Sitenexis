/**
 * Canonical BotFather configuration for the SiteNexis User Assistant bot.
 *
 * This is the single source of truth for the bot's public command list and
 * descriptions — so BotFather configuration is reproducible instead of
 * hand-typed into @BotFather once and forgotten. It talks to the SAME bot
 * this repo's webhook route serves (TELEGRAM_USER_BOT_TOKEN) and never
 * touches @SiteNexisOps_Bot (a fully separate token/config).
 *
 * SAFE BY DEFAULT: running this script with no flags only PRINTS what it
 * would send to Telegram. Nothing is sent to the live Bot API — and the bot
 * profile photo is NEVER handled here, since the Bot API has no method to
 * set it; that step is always manual, via @BotFather.
 *
 * Usage:
 *   npx tsx apps/web/scripts/telegram-user-bot-setup.mts            # dry run — prints only
 *   npx tsx apps/web/scripts/telegram-user-bot-setup.mts --apply    # actually calls the Bot API
 *
 * Requires TELEGRAM_USER_BOT_TOKEN in the environment. Never logs the token.
 */

const TELEGRAM_API_BASE = 'https://api.telegram.org';

// Command name: 1-32 chars, lowercase a-z/0-9/underscore. Description: <=256 UTF-8 chars.
const COMMANDS: Array<{ command: string; description: string }> = [
  { command: 'start', description: 'Connect your SiteNexis account and see your status' },
  { command: 'menu', description: 'Open the main menu' },
  { command: 'audit', description: 'Run an audit (uses your active website if no domain given)' },
  { command: 'addsite', description: 'Audit and add a new website to your account' },
  { command: 'status', description: 'Latest audit status for a website' },
  { command: 'history', description: 'Your audit history' },
  { command: 'monitor', description: 'Score trend and open/resolved issues for your active website' },
  { command: 'websites', description: 'List your SiteNexis websites' },
  { command: 'select', description: 'Set your active website' },
  { command: 'scores', description: 'Full canonical scorecard for your active website' },
  { command: 'aivisibility', description: 'AI Visibility score breakdown' },
  { command: 'retrieval', description: 'Retrieval Readiness score' },
  { command: 'machinetrust', description: 'Machine Trust score breakdown' },
  { command: 'citation', description: 'Citation Probability score' },
  { command: 'entity', description: 'Entity Intelligence summary' },
  { command: 'seo', description: 'Technical SEO score' },
  { command: 'schema', description: 'Schema coverage' },
  { command: 'performance', description: 'Technical performance score' },
  { command: 'links', description: 'Internal link graph strength' },
  { command: 'issues', description: 'All issues by severity' },
  { command: 'critical', description: 'Critical issues only' },
  { command: 'fixplan', description: 'Prioritized fix plan' },
  { command: 'report', description: 'Full Intelligence Report' },
  { command: 'compare', description: 'Diff your latest two completed audits' },
  { command: 'scout', description: 'Ask Scout a question about your audit' },
  { command: 'notifications', description: 'Choose which audit results message you' },
  { command: 'account', description: 'Your linked SiteNexis account' },
  { command: 'usage', description: 'Plan, credits, and audits used this month' },
  { command: 'settings', description: 'Notifications, account, and disconnect' },
  { command: 'alerts', description: 'What SiteNexis can alert you about' },
  { command: 'about', description: 'What SiteNexis is' },
  { command: 'privacy', description: 'Privacy policy' },
  { command: 'support', description: 'Get help' },
  { command: 'disconnect', description: 'Unlink this Telegram account' },
  { command: 'help', description: 'List everything this bot can do' },
];

const BOT_NAME_RECOMMENDATION = 'SiteNexis';
// Telegram's setMyShortDescription hard-limits this to 120 characters and
// rejects violations with the (unhelpfully-named) BOT_SHARETEXT_INVALID
// error rather than a length-specific message. The previous 126-char value
// with an ampersand tripped this. Keep this short, plain ASCII, no "&".
const SHORT_DESCRIPTION =
  'AI visibility, website audits, scores, issues, reports and Scout intelligence.';
const FULL_DESCRIPTION =
  'SiteNexis models how AI systems like ChatGPT, Perplexity, Google AI Overviews, and Gemini retrieve, interpret, trust, and recommend your website — then gives you a prioritized plan to fix what is blocking that process.\n\n' +
  'Connect your SiteNexis account with /start, then run audits and read your scores, issues, and fix plan directly from this chat. Ask Scout, the AI-grounded Q&A assistant, anything about your latest audit.';

function assertValidCommands(): void {
  for (const c of COMMANDS) {
    if (!/^[a-z][a-z0-9_]{0,31}$/.test(c.command)) {
      throw new Error(`Invalid command name: "${c.command}" (must be 1-32 chars, lowercase a-z/0-9/underscore, starting with a letter)`);
    }
    if (c.description.length === 0 || c.description.length > 256) {
      throw new Error(`Invalid description length for /${c.command}: ${c.description.length} chars (must be 1-256)`);
    }
  }
}

function assertValidShortDescription(): void {
  if (SHORT_DESCRIPTION.length === 0 || SHORT_DESCRIPTION.length > 120) {
    throw new Error(`Invalid short description length: ${SHORT_DESCRIPTION.length} chars (must be 1-120 — Telegram rejects violations as BOT_SHARETEXT_INVALID)`);
  }
}

async function callBotApi(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${TELEGRAM_API_BASE}/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json?.ok === false) {
    // Never interpolate the token into any error string.
    throw new Error(`${method} failed: ${res.status} ${JSON.stringify(json).slice(0, 300)}`);
  }
  console.log(`✓ ${method} applied`);
}

async function main(): Promise<void> {
  assertValidCommands();
  assertValidShortDescription();

  const apply = process.argv.includes('--apply');
  const token = process.env.TELEGRAM_USER_BOT_TOKEN;

  console.log('SiteNexis User Assistant — BotFather configuration');
  console.log(`Mode: ${apply ? 'APPLY (will call the live Bot API)' : 'DRY RUN (printing only, nothing sent)'}`);
  console.log('');
  console.log(`Recommended bot name: ${BOT_NAME_RECOMMENDATION}`);
  console.log(`Short description (<=120 chars, shown on the bot's profile): ${SHORT_DESCRIPTION}`);
  console.log(`Full description (shown before a user starts the chat):\n${FULL_DESCRIPTION}`);
  console.log('');
  console.log(`Commands (${COMMANDS.length}):`);
  for (const c of COMMANDS) console.log(`  /${c.command} — ${c.description}`);
  console.log('');
  console.log('NOTE: the bot profile photo cannot be set via the Bot API at all — it must');
  console.log('be uploaded manually through @BotFather (/setuserpic).');

  if (!apply) {
    console.log('');
    console.log('Dry run complete. Re-run with --apply (and TELEGRAM_USER_BOT_TOKEN set) to push this to Telegram.');
    return;
  }

  if (!token) {
    console.error('TELEGRAM_USER_BOT_TOKEN is not set — refusing to apply.');
    process.exitCode = 1;
    return;
  }

  await callBotApi(token, 'setMyCommands', { commands: COMMANDS });
  await callBotApi(token, 'setMyDescription', { description: FULL_DESCRIPTION });
  await callBotApi(token, 'setMyShortDescription', { short_description: SHORT_DESCRIPTION });
  console.log('');
  console.log('Done. Profile photo still requires a manual step via @BotFather.');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exitCode = 1;
});
