/**
 * Reusable inline keyboards for the Telegram User Assistant (T6).
 *
 * Centralising these means every menu/submenu is built once here and every
 * callback_data prefix has exactly one producer and one consumer — no menu
 * duplicates another menu's layout, and no callback-data format is invented
 * ad hoc per command.
 */
import type { InlineKeyboard } from '@/lib/telegram-user/provider';

// ─── Callback-data prefixes — single source of truth ──────────────────────────

export const CB = {
  SELECT: 'select:',        // existing (T2) — website select
  AUDIT_RUN: 'auditrun:',   // existing (T3) — confirm audit
  AUDIT_CANCEL: 'auditcancel',
  MENU: 'mnu:',             // main menu navigation
  INTEL: 'int:',            // intelligence submenu item
  NOTIF_TOGGLE: 'ntf:',     // toggle one notification preference field
  DISCONNECT_CONFIRM: 'disc:confirm',
  DISCONNECT_CANCEL: 'disc:cancel',
  SETTINGS: 'set:',         // settings submenu navigation
} as const;

// ─── /start state-aware keyboards ──────────────────────────────────────────────

export const START_UNLINKED_KEYBOARD: InlineKeyboard = [
  [{ text: 'Connect SiteNexis', callback_data: `${CB.MENU}connect` }],
  [{ text: 'Help', callback_data: `${CB.MENU}help` }, { text: 'Privacy', callback_data: `${CB.MENU}privacy` }],
];

export const START_LINKED_NO_DOMAIN_KEYBOARD: InlineKeyboard = [
  [{ text: 'Select Website', callback_data: `${CB.MENU}sites` }],
  [{ text: 'Account', callback_data: `${CB.MENU}account` }, { text: 'Help', callback_data: `${CB.MENU}help` }],
];

export const START_LINKED_ACTIVE_DOMAIN_KEYBOARD: InlineKeyboard = [
  [{ text: 'Run Audit', callback_data: `${CB.MENU}audit` }, { text: 'Intelligence', callback_data: `${CB.MENU}intel` }],
  [{ text: 'Report', callback_data: `${CB.MENU}report` }, { text: 'Ask Scout', callback_data: `${CB.MENU}scout` }],
  [{ text: 'Website', callback_data: `${CB.MENU}sites` }, { text: 'Notifications', callback_data: `${CB.MENU}notifications` }],
  [{ text: 'Account', callback_data: `${CB.MENU}account` }],
];

// ─── Main menu ──────────────────────────────────────────────────────────────

export const MAIN_MENU_KEYBOARD: InlineKeyboard = [
  [{ text: 'Run Audit', callback_data: `${CB.MENU}audit` }, { text: 'Intelligence', callback_data: `${CB.MENU}intel` }],
  [{ text: 'Report', callback_data: `${CB.MENU}report` }, { text: 'Ask Scout', callback_data: `${CB.MENU}scout` }],
  [{ text: 'Websites', callback_data: `${CB.MENU}sites` }, { text: 'Account', callback_data: `${CB.MENU}account` }],
  [{ text: 'Settings', callback_data: `${CB.MENU}settings` }, { text: 'Help', callback_data: `${CB.MENU}help` }],
];

// ─── Intelligence submenu ─────────────────────────────────────────────────────

/** key -> button label. The webhook route maps each key to its canonical command function — this file only owns layout. */
export const INTELLIGENCE_MENU_ITEMS: Array<{ key: string; label: string }> = [
  { key: 'scores', label: 'Scores' },
  { key: 'aivisibility', label: 'AI Visibility' },
  { key: 'retrieval', label: 'Retrieval' },
  { key: 'machinetrust', label: 'Machine Trust' },
  { key: 'citation', label: 'Citation' },
  { key: 'entity', label: 'Entity' },
  { key: 'seo', label: 'SEO' },
  { key: 'schema', label: 'Schema' },
  { key: 'performance', label: 'Performance' },
  { key: 'links', label: 'Links' },
  { key: 'issues', label: 'Issues' },
  { key: 'critical', label: 'Critical Issues' },
  { key: 'fixplan', label: 'Fix Plan' },
  { key: 'compare', label: 'Compare' },
];

export const INTELLIGENCE_MENU_KEYBOARD: InlineKeyboard = chunkPairs(
  INTELLIGENCE_MENU_ITEMS.map((item) => ({ text: item.label, callback_data: `${CB.INTEL}${item.key}` })),
);

function chunkPairs<T>(items: T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  return rows;
}

// ─── Settings submenu ─────────────────────────────────────────────────────────

export const SETTINGS_MENU_KEYBOARD: InlineKeyboard = [
  [{ text: 'Notifications', callback_data: `${CB.SETTINGS}notif` }],
  [{ text: 'Account', callback_data: `${CB.SETTINGS}account` }],
  [{ text: 'Disconnect', callback_data: `${CB.SETTINGS}disconnect` }],
];

// ─── Notifications toggle keyboard ─────────────────────────────────────────────

export interface NotificationPrefsForKeyboard {
  notifyOnComplete: boolean;
  notifyOnPartial: boolean;
  notifyOnFailed: boolean;
}

/**
 * `notifyOnStalled` exists on the DB model but has no send-trigger anywhere
 * in the codebase yet — deliberately omitted here rather than exposing a
 * toggle that would silently do nothing (see CLAUDE.md "do not invent
 * background monitoring if no canonical capability exists").
 */
export function notificationsKeyboard(prefs: NotificationPrefsForKeyboard): InlineKeyboard {
  const check = (on: boolean) => (on ? '✅' : '⬜');
  return [
    [{ text: `${check(prefs.notifyOnComplete)} Audit complete`, callback_data: `${CB.NOTIF_TOGGLE}c` }],
    [{ text: `${check(prefs.notifyOnPartial)} Audit partial`, callback_data: `${CB.NOTIF_TOGGLE}p` }],
    [{ text: `${check(prefs.notifyOnFailed)} Audit failed`, callback_data: `${CB.NOTIF_TOGGLE}f` }],
  ];
}

export const NOTIF_TOGGLE_FIELD: Record<string, keyof NotificationPrefsForKeyboard> = {
  c: 'notifyOnComplete',
  p: 'notifyOnPartial',
  f: 'notifyOnFailed',
};

// ─── Disconnect confirmation ────────────────────────────────────────────────

export const DISCONNECT_CONFIRM_KEYBOARD: InlineKeyboard = [
  [{ text: 'Confirm Disconnect', callback_data: CB.DISCONNECT_CONFIRM }, { text: 'Cancel', callback_data: CB.DISCONNECT_CANCEL }],
];

// ─── Audit result notification buttons ─────────────────────────────────────────

/**
 * Attached to audit-completion/partial notifications. Every button routes
 * through the SAME `int:`/`mnu:` callback namespace as the main menu — no
 * separate callback format for "buttons that happen to be on a
 * notification" vs. "buttons on a menu".
 */
export function auditResultKeyboard(): InlineKeyboard {
  return [
    [{ text: 'View Scores', callback_data: `${CB.INTEL}scores` }, { text: 'View Issues', callback_data: `${CB.INTEL}issues` }],
    [{ text: 'Fix Plan', callback_data: `${CB.INTEL}fixplan` }, { text: 'Full Report', callback_data: `${CB.MENU}report` }],
    [{ text: 'Ask Scout', callback_data: `${CB.MENU}scout` }],
  ];
}
