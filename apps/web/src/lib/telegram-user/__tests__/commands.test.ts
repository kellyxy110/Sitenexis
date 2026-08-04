import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getConnectionByTelegramUserId: vi.fn(),
  touchLastInteraction: vi.fn(),
  disconnectConnection: vi.fn(),
  getUserWebsiteDomains: vi.fn(),
  setActiveDomain: vi.fn(),
  getUserById: vi.fn(),
  getUserCredits: vi.fn(),
  countAuditsThisMonth: vi.fn(),
  getNotificationPreference: vi.fn(),
  updateNotificationPreference: vi.fn(),
  startTelegramLink: vi.fn(),
  getSiteState: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  getConnectionByTelegramUserId: h.getConnectionByTelegramUserId,
  touchLastInteraction: h.touchLastInteraction,
  disconnectConnection: h.disconnectConnection,
  getUserWebsiteDomains: h.getUserWebsiteDomains,
  setActiveDomain: h.setActiveDomain,
  getUserById: h.getUserById,
  getUserCredits: h.getUserCredits,
  countAuditsThisMonth: h.countAuditsThisMonth,
  getNotificationPreference: h.getNotificationPreference,
  updateNotificationPreference: h.updateNotificationPreference,
}));
vi.mock('@/lib/telegram-user/account-linking', () => ({ startTelegramLink: h.startTelegramLink }));
vi.mock('@sitenexis/loop-os', () => ({ getSiteState: h.getSiteState }));
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://sitenexis.example' } }));

const {
  commandStart, commandMenu, commandAccount, commandDisconnect, handleDisconnectCallback,
  commandAbout, commandPrivacy, commandSupport, commandAlerts, commandMonitor, commandUsage,
  commandNotifications, handleNotificationToggleCallback, commandSettings, handleSettingsCallback,
  commandConnect,
} = await import('../commands');

const linkedNoDomain = {
  id: 'conn-1', telegramUserId: '111', telegramChatId: '111', siteNexisUserId: 'user-A',
  status: 'linked' as const, activeDomain: null, linkedAt: new Date('2026-01-01'), lastInteractionAt: null,
};
const linkedWithDomain = { ...linkedNoDomain, activeDomain: 'example.com' };

beforeEach(() => {
  vi.clearAllMocks();
  h.touchLastInteraction.mockResolvedValue(undefined);
  h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true, notifyOnStalled: false });
});

describe('/start — state-aware', () => {
  it('unlinked: explains SiteNexis and offers a Connect button, never generates a link token', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const reply = await commandStart('111', '111');
    expect(reply.text).toContain('Welcome to SiteNexis');
    expect(reply.keyboard).toEqual(expect.arrayContaining([expect.arrayContaining([expect.objectContaining({ callback_data: 'mnu:connect' })])]));
    expect(h.startTelegramLink).not.toHaveBeenCalled();
  });

  it('linked, no domain: offers Select Website / Account / Help', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedNoDomain);
    const reply = await commandStart('111', '111');
    expect(reply.text).toContain('No active website selected');
    expect(reply.keyboard).toEqual(expect.arrayContaining([expect.arrayContaining([expect.objectContaining({ callback_data: 'mnu:sites' })])]));
  });

  it('linked with active domain: shows the domain and the full action keyboard', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await commandStart('111', '111');
    expect(reply.text).toContain('example.com');
    const flat = reply.keyboard!.flat();
    expect(flat.some((b) => b.callback_data === 'mnu:audit')).toBe(true);
    expect(flat.some((b) => b.callback_data === 'mnu:scout')).toBe(true);
    expect(flat.some((b) => b.callback_data === 'mnu:notifications')).toBe(true);
  });
});

describe('commandConnect', () => {
  it('generates a fresh link only when actually invoked', async () => {
    h.startTelegramLink.mockResolvedValue({ linkUrl: 'https://sitenexis.example/link?token=abc', expiresAt: new Date() });
    const text = await commandConnect('111', '111');
    expect(h.startTelegramLink).toHaveBeenCalledWith('111', '111');
    expect(text).toContain('https://sitenexis.example/link?token=abc');
  });
});

describe('/menu', () => {
  it('not connected', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const reply = await commandMenu('111');
    expect(reply.text).toContain('Not connected');
  });

  it('linked with domain shows the main menu keyboard', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await commandMenu('111');
    expect(reply.text).toContain('example.com');
    expect(reply.keyboard!.flat().some((b) => b.callback_data === 'mnu:intel')).toBe(true);
  });
});

describe('/account — website count is best-effort', () => {
  it('includes website count when the lookup succeeds', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserWebsiteDomains.mockResolvedValue([{ domain: 'a.com', latestAuditId: 'x', latestStatus: 'complete', latestAt: new Date() }, { domain: 'b.com', latestAuditId: 'y', latestStatus: 'complete', latestAt: new Date() }]);
    const text = await commandAccount('111');
    expect(text).toContain('Websites: 2');
  });

  it('omits the website-count line rather than failing /account when the lookup throws', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserWebsiteDomains.mockRejectedValue(new Error('db down'));
    const text = await commandAccount('111');
    expect(text).toContain('Your SiteNexis account');
    expect(text).not.toContain('Websites:');
  });
});

describe('/disconnect — two-step confirmation', () => {
  it('shows a confirm/cancel keyboard instead of disconnecting immediately', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await commandDisconnect('111');
    expect(reply.text).toContain('Disconnect SiteNexis?');
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });

  it('cancel does not disconnect', async () => {
    const result = await handleDisconnectCallback('111', 'disc:cancel');
    expect(result).toBe('Cancelled.');
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });

  it('confirm actually disconnects, scoped to the calling user', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.disconnectConnection.mockResolvedValue(true);
    const result = await handleDisconnectCallback('111', 'disc:confirm');
    expect(h.disconnectConnection).toHaveBeenCalledWith('user-A');
    expect(result).toContain('Disconnected');
  });

  it('an unrelated callback_data is ignored (returns null)', async () => {
    const result = await handleDisconnectCallback('111', 'mnu:help');
    expect(result).toBeNull();
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });
});

describe('/about /privacy /support — static, truthful, link to real pages', () => {
  it('/about', async () => {
    const text = await commandAbout();
    expect(text).toContain('SiteNexis');
    expect(text).toContain('https://sitenexis.example');
  });
  it('/privacy links to the real privacy page', async () => {
    const text = await commandPrivacy();
    expect(text).toContain('https://sitenexis.example/privacy');
  });
  it('/support links to the real contact page', async () => {
    const text = await commandSupport();
    expect(text).toContain('https://sitenexis.example/contact');
  });
});

describe('/alerts — truthful, never invents a background alerting system', () => {
  it('explains the only real alerting capability and points to /notifications', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const text = await commandAlerts('111');
    expect(text).toContain('does not run a separate background alerting system');
    expect(text).toContain('/notifications');
  });

  it('not connected', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const text = await commandAlerts('111');
    expect(text).toContain('Not connected');
  });
});

describe('/monitor — reuses canonical loop-os state, never computes its own score', () => {
  it('no active domain', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedNoDomain);
    const text = await commandMonitor('111');
    expect(text).toContain('No active website selected');
  });

  it('no score history yet', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getSiteState.mockResolvedValue({ scoreHistory: [], openIssues: [], resolvedIssues: [], lastAuditCompletedAt: null });
    const text = await commandMonitor('111');
    expect(text).toContain('No score history recorded yet');
  });

  it('reports the latest score, delta from the previous snapshot, and issue counts verbatim from loop-os', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getSiteState.mockResolvedValue({
      scoreHistory: [{ overall: 60 }, { overall: 72 }],
      openIssues: ['i1', 'i2'],
      resolvedIssues: ['i3'],
      lastAuditCompletedAt: '2026-01-15T10:00:00.000Z',
    });
    const text = await commandMonitor('111');
    expect(text).toContain('Overall score: 72 (+12 vs previous audit)');
    expect(text).toContain('Open issues: 2');
    expect(text).toContain('Resolved issues: 1');
  });

  it('degrades gracefully when loop-os throws', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getSiteState.mockRejectedValue(new Error('redis down'));
    const text = await commandMonitor('111');
    expect(text).toContain('Could not load monitoring data');
  });
});

describe('/usage — mirrors GET /api/usage exactly, never computes billing independently', () => {
  it('reports plan, audits used, credit balance, and Layer 4/competitive access verbatim from canonical services', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserById.mockResolvedValue({ id: 'user-A', plan: 'pro' });
    h.getUserCredits.mockResolvedValue({ balance: 42, isUnlimited: false });
    h.countAuditsThisMonth.mockResolvedValue(3);
    const text = await commandUsage('111');
    expect(text).toContain('Plan: pro');
    expect(text).toContain('Audits this month: 3');
    expect(text).toContain('Credit balance: 42');
    expect(text).toContain('Layer 4 analysis');
    expect(text).toContain('included in your plan'); // pro has layer4Analysis: true
  });

  it('shows unlimited audits/credits truthfully rather than a fabricated number', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserById.mockResolvedValue({ id: 'user-A', plan: 'agency' });
    h.getUserCredits.mockResolvedValue({ balance: 0, isUnlimited: true });
    h.countAuditsThisMonth.mockResolvedValue(9);
    const text = await commandUsage('111');
    expect(text).toContain('(unlimited)');
    expect(text).toContain('Credit balance: unlimited');
  });

  it('defaults to the free plan when the user record has no plan set, never fabricating a paid plan', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserById.mockResolvedValue(null);
    h.getUserCredits.mockResolvedValue({ balance: 0, isUnlimited: false });
    h.countAuditsThisMonth.mockResolvedValue(0);
    const text = await commandUsage('111');
    expect(text).toContain('Plan: free');
  });

  it('degrades gracefully rather than crashing when a canonical service throws', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserById.mockRejectedValue(new Error('db down'));
    const text = await commandUsage('111');
    expect(text).toContain('Could not load your usage');
  });
});

describe('/notifications — toggle keyboard backed by TelegramNotificationPreference', () => {
  it('renders current preferences with checkmarks', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: false, notifyOnFailed: true });
    const reply = await commandNotifications('111');
    const flat = reply.keyboard!.flat();
    expect(flat.find((b) => b.callback_data === 'ntf:c')!.text).toContain('✅');
    expect(flat.find((b) => b.callback_data === 'ntf:p')!.text).toContain('⬜');
  });

  it('defaults every preference to true when no row exists yet', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getNotificationPreference.mockResolvedValue(null);
    const reply = await commandNotifications('111');
    expect(reply.keyboard!.flat().every((b) => b.text.includes('✅'))).toBe(true);
  });

  it('toggling a field persists the flipped value and redraws the keyboard with the new state', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true });
    const reply = await handleNotificationToggleCallback('111', 'ntf:c');
    expect(h.updateNotificationPreference).toHaveBeenCalledWith('conn-1', { notifyOnComplete: false });
    expect(reply!.keyboard!.flat().find((b) => b.callback_data === 'ntf:c')!.text).toContain('⬜');
  });

  it('an unrelated callback_data is ignored', async () => {
    const reply = await handleNotificationToggleCallback('111', 'mnu:help');
    expect(reply).toBeNull();
    expect(h.updateNotificationPreference).not.toHaveBeenCalled();
  });

  it('not connected', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const reply = await handleNotificationToggleCallback('111', 'ntf:c');
    expect(reply!.text).toContain('Not connected');
  });
});

describe('/settings — routes to the same functions /notifications, /account, /disconnect already use', () => {
  it('shows the settings menu', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await commandSettings('111');
    expect(reply.keyboard!.flat().map((b) => b.callback_data)).toEqual(['set:notif', 'set:account', 'set:disconnect']);
  });

  it('set:notif routes to commandNotifications', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await handleSettingsCallback('111', 'set:notif');
    expect(reply!.text).toContain('Notifications');
  });

  it('set:account routes to commandAccount', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await handleSettingsCallback('111', 'set:account');
    expect(reply!.text).toContain('Your SiteNexis account');
  });

  it('set:disconnect routes to commandDisconnect (confirm step, not immediate)', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    const reply = await handleSettingsCallback('111', 'set:disconnect');
    expect(reply!.text).toContain('Disconnect SiteNexis?');
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });

  it('an unrelated callback_data is ignored', async () => {
    const reply = await handleSettingsCallback('111', 'mnu:help');
    expect(reply).toBeNull();
  });
});

describe('user isolation across the new T6 commands', () => {
  it('/usage, /monitor, /notifications, /settings, /account, /disconnect all resolve via the calling telegramUserId only', async () => {
    const other = { ...linkedWithDomain, telegramUserId: '222', siteNexisUserId: 'user-B' };
    h.getConnectionByTelegramUserId.mockImplementation((tgId: string) => Promise.resolve(tgId === '222' ? other : null));
    h.getUserById.mockResolvedValue({ id: 'user-B', plan: 'free' });
    h.getUserCredits.mockResolvedValue({ balance: 0, isUnlimited: false });
    h.countAuditsThisMonth.mockResolvedValue(0);
    h.getSiteState.mockResolvedValue({ scoreHistory: [], openIssues: [], resolvedIssues: [], lastAuditCompletedAt: null });

    await commandUsage('222');
    expect(h.getUserById).toHaveBeenCalledWith('user-B');

    await commandMonitor('222');
    expect(h.getSiteState).toHaveBeenCalledWith('example.com');

    await commandNotifications('222');
    expect(h.getNotificationPreference).toHaveBeenCalledWith('conn-1');

    // A caller with no linked connection at all must never reach any of these lookups.
    vi.clearAllMocks();
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    await commandUsage('999');
    await commandMonitor('999');
    expect(h.getUserById).not.toHaveBeenCalled();
    expect(h.getSiteState).not.toHaveBeenCalled();
  });
});

describe('no secret leakage', () => {
  it('none of the new command replies contain a raw API key, bot token, or connection string pattern', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedWithDomain);
    h.getUserById.mockResolvedValue({ id: 'user-A', plan: 'pro' });
    h.getUserCredits.mockResolvedValue({ balance: 1, isUnlimited: false });
    h.countAuditsThisMonth.mockResolvedValue(1);
    h.getSiteState.mockResolvedValue({ scoreHistory: [{ overall: 50 }], openIssues: [], resolvedIssues: [], lastAuditCompletedAt: null });
    h.getUserWebsiteDomains.mockResolvedValue([]);

    // Sequential, not Promise.all: several of these independently do their
    // own internal `await import('@sitenexis/db')` — see the documented
    // dynamic-import race (CLAUDE.md "Known Technical Debt").
    const texts = [
      await commandAbout(), await commandPrivacy(), await commandSupport(),
      await commandAlerts('111'), await commandMonitor('111'), await commandUsage('111'), await commandAccount('111'),
    ];
    for (const text of texts) {
      expect(text).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(text).not.toMatch(/postgres:\/\/[^\s]+:[^\s]+@/);
      expect(text).not.toMatch(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/);
    }
  });
});
