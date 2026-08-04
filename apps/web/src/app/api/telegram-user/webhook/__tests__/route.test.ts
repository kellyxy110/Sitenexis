import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  isValidUserBotWebhookSecret: vi.fn(),
  sendUserBotMessage: vi.fn(),
  answerCallbackQuery: vi.fn(),
  getConnectionByTelegramUserId: vi.fn(),
  getUserWebsiteDomains: vi.fn(),
  setActiveDomain: vi.fn(),
  disconnectConnection: vi.fn(),
  touchLastInteraction: vi.fn(),
  startTelegramLink: vi.fn(),
  startAuditForUser: vi.fn(),
  getLatestAuditByDomain: vi.fn(),
  listAuditsByUser: vi.fn(),
  getUserById: vi.fn(),
  getNotificationPreference: vi.fn(),
  updateNotificationPreference: vi.fn(),
  commandScores: vi.fn(),
  commandAiVisibility: vi.fn(),
  commandRetrieval: vi.fn(),
  commandMachineTrust: vi.fn(),
  commandCitation: vi.fn(),
  commandEntity: vi.fn(),
  commandSeo: vi.fn(),
  commandSchema: vi.fn(),
  commandPerformance: vi.fn(),
  commandLinks: vi.fn(),
  commandIssues: vi.fn(),
  commandCritical: vi.fn(),
  commandFixplan: vi.fn(),
  commandReport: vi.fn(),
  commandCompare: vi.fn(),
  commandScout: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/telegram-user/provider', () => ({
  isValidUserBotWebhookSecret: h.isValidUserBotWebhookSecret,
  sendUserBotMessage: h.sendUserBotMessage,
  answerCallbackQuery: h.answerCallbackQuery,
}));
vi.mock('@sitenexis/db', () => ({
  getConnectionByTelegramUserId: h.getConnectionByTelegramUserId,
  getUserWebsiteDomains: h.getUserWebsiteDomains,
  setActiveDomain: h.setActiveDomain,
  disconnectConnection: h.disconnectConnection,
  touchLastInteraction: h.touchLastInteraction,
  getLatestAuditByDomain: h.getLatestAuditByDomain,
  listAuditsByUser: h.listAuditsByUser,
  getUserById: h.getUserById,
  getNotificationPreference: h.getNotificationPreference,
  updateNotificationPreference: h.updateNotificationPreference,
}));
vi.mock('@/lib/telegram-user/account-linking', () => ({
  startTelegramLink: h.startTelegramLink,
}));
// normalizeAndValidateDomain is real (pure logic) — only startAuditForUser (DB/credits) is mocked.
vi.mock('@/lib/audit-orchestration', async () => {
  const actual = await vi.importActual<typeof import('@/lib/audit-orchestration')>('@/lib/audit-orchestration');
  return { ...actual, startAuditForUser: h.startAuditForUser };
});
// The 15 canonical intelligence commands are unit-tested in depth in
// intelligence-commands.test.ts (scoring, escaping, isolation, zero-LLM
// proof). This route test only needs to prove correct dispatch + chunking.
vi.mock('@/lib/telegram-user/intelligence-commands', () => ({
  commandScores: h.commandScores,
  commandAiVisibility: h.commandAiVisibility,
  commandRetrieval: h.commandRetrieval,
  commandMachineTrust: h.commandMachineTrust,
  commandCitation: h.commandCitation,
  commandEntity: h.commandEntity,
  commandSeo: h.commandSeo,
  commandSchema: h.commandSchema,
  commandPerformance: h.commandPerformance,
  commandLinks: h.commandLinks,
  commandIssues: h.commandIssues,
  commandCritical: h.commandCritical,
  commandFixplan: h.commandFixplan,
  commandReport: h.commandReport,
  commandCompare: h.commandCompare,
}));
vi.mock('@/lib/telegram-user/scout-command', () => ({
  commandScout: h.commandScout,
}));

const { POST } = await import('../route');

function req(body: unknown, secret = 'good-secret'): NextRequest {
  return {
    headers: new Headers({ 'x-telegram-bot-api-secret-token': secret }),
    json: async () => body,
  } as unknown as NextRequest;
}

const linkedConnection = {
  id: 'conn-1', telegramUserId: '111', telegramChatId: '111', siteNexisUserId: 'user-A',
  status: 'linked', activeDomain: null, linkedAt: new Date(), lastInteractionAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.isValidUserBotWebhookSecret.mockImplementation((s: string) => s === 'good-secret');
  h.sendUserBotMessage.mockResolvedValue(true);
  h.answerCallbackQuery.mockResolvedValue(undefined);
  h.touchLastInteraction.mockResolvedValue(undefined);
  h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true, notifyOnStalled: false });
  h.updateNotificationPreference.mockResolvedValue(undefined);
});

describe('POST /api/telegram-user/webhook — auth', () => {
  it('401s on an invalid webhook secret', async () => {
    const res = await POST(req({ message: { from: { id: 1 }, chat: { id: 1, type: 'private' }, text: '/help' } }, 'wrong-secret'));
    expect(res.status).toBe(401);
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });

  it('never leaks the webhook secret or bot token in the error response', async () => {
    const res = await POST(req({}, 'wrong-secret'));
    const body = await res.json();
    expect(JSON.stringify(body)).not.toMatch(/good-secret|bot\d+:/i);
  });
});

describe('POST /api/telegram-user/webhook — private-chat restriction', () => {
  it('declines a group chat without dispatching any command', async () => {
    const res = await POST(req({ message: { from: { id: 1 }, chat: { id: -100, type: 'group' }, text: '/start' } }));
    expect(res.status).toBe(200);
    expect(h.startTelegramLink).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('-100', expect.stringMatching(/private chat/i));
  });

  it('declines a callback from a non-private chat', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 1 }, message: { chat: { id: -100, type: 'group' } }, data: 'select:example.com' } }));
    expect(h.answerCallbackQuery).toHaveBeenCalledWith('cb1', expect.stringMatching(/private/i));
    expect(h.setActiveDomain).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — identity resolution', () => {
  it('resolves identity from from.id only — a username field is never consulted', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111, username: 'totally-different-name' }, chat: { id: 111, type: 'private' }, text: '/account' } }));
    expect(h.getConnectionByTelegramUserId).toHaveBeenCalledWith('111');
  });
});

describe('POST /api/telegram-user/webhook — cross-user isolation', () => {
  it('User A cannot list User B\'s domains via /websites — lookup is always scoped to the requester\'s own connection', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getUserWebsiteDomains.mockResolvedValue([{ domain: 'a-owns-this.com', latestAuditId: 'x', latestStatus: 'complete', latestAt: new Date() }]);

    await POST(req({ message: { from: { id: 'A' }, chat: { id: 'A', type: 'private' }, text: '/websites' } }));

    expect(h.getConnectionByTelegramUserId).toHaveBeenCalledWith('A');
    expect(h.getUserWebsiteDomains).toHaveBeenCalledWith('user-A');
  });

  it('User A cannot select User B\'s domain — /select rejects a domain not in the requester\'s own list', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getUserWebsiteDomains.mockResolvedValue([{ domain: 'a-owns-this.com', latestAuditId: 'x', latestStatus: 'complete', latestAt: new Date() }]);

    await POST(req({ message: { from: { id: 'A' }, chat: { id: 'A', type: 'private' }, text: '/select b-owns-this.com' } }));

    expect(h.setActiveDomain).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', expect.stringMatching(/isn't in your SiteNexis account/), undefined);
  });

  it('a disconnected connection cannot select a domain', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, status: 'disconnected' });
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/select example.com' } }));
    expect(h.setActiveDomain).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/not connected/i), undefined);
  });

  it('a disconnected connection cannot list websites', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, status: 'disconnected' });
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/websites' } }));
    expect(h.getUserWebsiteDomains).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — callback ownership', () => {
  it('re-verifies ownership server-side rather than trusting callback_data', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getUserWebsiteDomains.mockResolvedValue([{ domain: 'a-owns-this.com', latestAuditId: 'x', latestStatus: 'complete', latestAt: new Date() }]);
    h.setActiveDomain.mockResolvedValue(true);

    await POST(req({ callback_query: { id: 'cb1', from: { id: 'A' }, message: { chat: { id: 'A', type: 'private' } }, data: 'select:a-owns-this.com' } }));

    expect(h.getConnectionByTelegramUserId).toHaveBeenCalledWith('A');
    expect(h.setActiveDomain).toHaveBeenCalledWith('A', 'a-owns-this.com');
  });

  it('an arbitrary/forged callback payload naming a domain the caller does not own is rejected', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'attacker', siteNexisUserId: 'user-attacker' });
    h.getUserWebsiteDomains.mockResolvedValue([]); // attacker owns nothing

    await POST(req({ callback_query: { id: 'cb1', from: { id: 'attacker' }, message: { chat: { id: 'attacker', type: 'private' } }, data: 'select:victim-owned-site.com' } }));

    expect(h.setActiveDomain).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — unimplemented commands', () => {
  it('truthfully reports an unimplemented command rather than silently failing or pretending to work', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/quickaudit' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/not available yet/i), undefined);
  });
});

describe('POST /api/telegram-user/webhook — canonical intelligence commands: dispatch wiring', () => {
  it.each([
    ['/scores', 'commandScores', h.commandScores],
    ['/aivisibility', 'commandAiVisibility', h.commandAiVisibility],
    ['/retrieval', 'commandRetrieval', h.commandRetrieval],
    ['/machinetrust', 'commandMachineTrust', h.commandMachineTrust],
    ['/citation', 'commandCitation', h.commandCitation],
    ['/entity', 'commandEntity', h.commandEntity],
    ['/seo', 'commandSeo', h.commandSeo],
    ['/schema', 'commandSchema', h.commandSchema],
    ['/performance', 'commandPerformance', h.commandPerformance],
    ['/links', 'commandLinks', h.commandLinks],
    ['/issues', 'commandIssues', h.commandIssues],
    ['/critical', 'commandCritical', h.commandCritical],
    ['/fixplan', 'commandFixplan', h.commandFixplan],
    ['/report', 'commandReport', h.commandReport],
    ['/compare', 'commandCompare', h.commandCompare],
  ] as const)('%s dispatches to %s and sends its reply', async (command, _name, mockFn) => {
    mockFn.mockResolvedValue(`reply for ${command}`);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: command } }));
    expect(mockFn).toHaveBeenCalledWith('111');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', `reply for ${command}`, undefined);
  });
});

describe('POST /api/telegram-user/webhook — /scout dispatch wiring', () => {
  it('/scout dispatches to commandScout with the parsed question args and sends its reply', async () => {
    h.commandScout.mockResolvedValue('scout reply');
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/scout What should I fix first?' } }));
    expect(h.commandScout).toHaveBeenCalledWith('111', ['What', 'should', 'I', 'fix', 'first?']);
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', 'scout reply', undefined);
  });

  it('/scout with no question still dispatches with an empty args array', async () => {
    h.commandScout.mockResolvedValue('usage reply');
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/scout' } }));
    expect(h.commandScout).toHaveBeenCalledWith('111', []);
  });
});

describe('POST /api/telegram-user/webhook — T6 standalone command dispatch wiring', () => {
  it('/menu, /about, /privacy, /support, /alerts, /monitor, /usage, /notifications, /settings all reply without throwing', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    for (const cmd of ['/menu', '/about', '/privacy', '/support', '/alerts', '/monitor', '/usage', '/notifications', '/settings']) {
      h.sendUserBotMessage.mockClear();
      await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: cmd } }));
      expect(h.sendUserBotMessage).toHaveBeenCalled();
    }
  });

  it('/disconnect now shows a confirmation prompt rather than disconnecting immediately', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/disconnect' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/Disconnect SiteNexis\?/), expect.objectContaining({ inline_keyboard: expect.any(Array) }));
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — mnu: main-menu callback dispatch', () => {
  it('mnu:help sends the help text', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:help' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/SiteNexis Assistant/), undefined);
    expect(h.answerCallbackQuery).toHaveBeenCalledWith('cb1');
  });

  it('mnu:report routes to the same commandReport used by /report', async () => {
    h.commandReport.mockResolvedValue('the report');
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:report' } }));
    expect(h.commandReport).toHaveBeenCalledWith('111');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', 'the report', undefined);
  });

  it('mnu:scout routes to the same commandScout used by /scout, with an empty question', async () => {
    h.commandScout.mockResolvedValue('scout usage text');
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:scout' } }));
    expect(h.commandScout).toHaveBeenCalledWith('111', []);
  });

  it('mnu:sites routes to commandWebsites', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    h.getUserWebsiteDomains.mockResolvedValue([]);
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:sites' } }));
    expect(h.getUserWebsiteDomains).toHaveBeenCalledWith('user-A');
  });

  it('mnu:intel opens the intelligence submenu keyboard', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:intel' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/Intelligence/), expect.objectContaining({ inline_keyboard: expect.any(Array) }));
  });

  it('mnu:connect generates a fresh connect link via account-linking, never a stale one baked into an earlier /start', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    h.startTelegramLink.mockResolvedValue({ linkUrl: 'https://sitenexis.example/link?token=xyz', expiresAt: new Date() });
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:connect' } }));
    expect(h.startTelegramLink).toHaveBeenCalledWith('111', '111');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringContaining('https://sitenexis.example/link?token=xyz'), undefined);
  });

  it('an unrecognized mnu: key answers the callback but sends no message', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'mnu:nonsense' } }));
    expect(h.answerCallbackQuery).toHaveBeenCalledWith('cb1');
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — int: intelligence-submenu callback dispatch', () => {
  it('int:scores routes to the exact same commandScores function /scores uses', async () => {
    h.commandScores.mockResolvedValue('scores reply');
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'int:scores' } }));
    expect(h.commandScores).toHaveBeenCalledWith('111');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', 'scores reply', undefined);
  });

  it('int:fixplan routes to commandFixplan', async () => {
    h.commandFixplan.mockResolvedValue('fix plan reply');
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'int:fixplan' } }));
    expect(h.commandFixplan).toHaveBeenCalledWith('111');
  });
});

describe('POST /api/telegram-user/webhook — ntf: notification-toggle callback dispatch', () => {
  it('toggles the correct preference field, scoped to the caller\'s own connection', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true });
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'ntf:f' } }));
    expect(h.updateNotificationPreference).toHaveBeenCalledWith('conn-1', { notifyOnFailed: false });
  });
});

describe('POST /api/telegram-user/webhook — set: settings callback dispatch', () => {
  it('set:disconnect shows the confirmation prompt, not an immediate disconnect', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'set:disconnect' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/Disconnect SiteNexis\?/), expect.objectContaining({ inline_keyboard: expect.any(Array) }));
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — disc: disconnect confirmation callback dispatch', () => {
  it('disc:confirm actually disconnects, scoped to the caller\'s own account', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.disconnectConnection.mockResolvedValue(true);
    await POST(req({ callback_query: { id: 'cb1', from: { id: 'A' }, message: { chat: { id: 'A', type: 'private' } }, data: 'disc:confirm' } }));
    expect(h.disconnectConnection).toHaveBeenCalledWith('user-A');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', expect.stringMatching(/Disconnected/), undefined);
  });

  it('disc:cancel never disconnects', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } }, data: 'disc:cancel' } }));
    expect(h.disconnectConnection).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', 'Cancelled.', undefined);
  });

  it('a forged disc:confirm from an unlinked identity is rejected truthfully, never disconnecting anyone', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    await POST(req({ callback_query: { id: 'cb1', from: { id: 'attacker' }, message: { chat: { id: 'attacker', type: 'private' } }, data: 'disc:confirm' } }));
    expect(h.disconnectConnection).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — malformed callback handling', () => {
  it('a callback with no data field is ignored entirely', async () => {
    await POST(req({ callback_query: { id: 'cb1', from: { id: 111 }, message: { chat: { id: 111, type: 'private' } } } }));
    expect(h.answerCallbackQuery).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });

  it('a callback with no from.id is ignored entirely (never resolves any identity)', async () => {
    await POST(req({ callback_query: { id: 'cb1', message: { chat: { id: 111, type: 'private' } }, data: 'mnu:help' } }));
    expect(h.getConnectionByTelegramUserId).not.toHaveBeenCalled();
  });

  it('a completely malformed JSON body never throws — returns 200 ok', async () => {
    const badReq = { headers: new Headers({ 'x-telegram-bot-api-secret-token': 'good-secret' }), json: async () => { throw new Error('bad json'); } } as unknown as NextRequest;
    const res = await POST(badReq);
    expect(res.status).toBe(200);
  });
});

describe('POST /api/telegram-user/webhook — long output chunking', () => {
  it('splits a reply over 4096 characters into multiple sequential messages with page indicators', async () => {
    const longReply = Array.from({ length: 200 }, (_, i) => `<b>Line ${i}</b> some evidence text here`).join('\n');
    h.commandFixplan.mockResolvedValue(longReply);

    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/fixplan' } }));

    expect(h.sendUserBotMessage.mock.calls.length).toBeGreaterThan(1);
    const allText = h.sendUserBotMessage.mock.calls.map((c) => c[1]).join('');
    // Every original line survives across the chunk boundaries, unbroken.
    expect(allText).toContain('<b>Line 0</b>');
    expect(allText).toContain('<b>Line 199</b>');
    const lastCall = h.sendUserBotMessage.mock.calls[h.sendUserBotMessage.mock.calls.length - 1];
    expect(lastCall[1]).toMatch(/\(\d+\/\d+\)/);
  });

  it('sends a short reply as a single message with no page indicator', async () => {
    h.commandScores.mockResolvedValue('short reply');
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/scores' } }));
    expect(h.sendUserBotMessage).toHaveBeenCalledTimes(1);
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', 'short reply', undefined);
  });
});

describe('POST /api/telegram-user/webhook — /audit and /addsite: unauthorized user', () => {
  it('rejects /audit for a Telegram user with no linked connection', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    await POST(req({ message: { from: { id: 999 }, chat: { id: 999, type: 'private' }, text: '/audit example.com' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('999', expect.stringMatching(/not connected/i), undefined);
  });

  it('rejects /addsite for a disconnected connection', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, status: 'disconnected' });
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/addsite example.com' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
  });
});

describe('POST /api/telegram-user/webhook — /audit domain validation', () => {
  it('rejects an unauthorized/malformed domain without ever calling startAuditForUser', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/audit not a domain' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/valid domain/i), undefined);
  });

  it('rejects a private/reserved domain (SSRF guard) without ever calling startAuditForUser', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/audit 10.mycompany.internal' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/private or reserved/i), undefined);
  });

  it('shows a Run Audit / Cancel confirmation keyboard for a valid domain — does not start the audit yet', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
    await POST(req({ message: { from: { id: 111 }, chat: { id: 111, type: 'private' }, text: '/audit example.com' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith(
      '111',
      expect.stringMatching(/example\.com/),
      { inline_keyboard: [[{ text: 'Run Audit', callback_data: 'auditrun:example.com' }, { text: 'Cancel', callback_data: 'auditcancel' }]] },
    );
  });
});

describe('POST /api/telegram-user/webhook — Run Audit confirmation callback', () => {
  it('starts the audit via the shared orchestration function on confirmation', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getUserById.mockResolvedValue({ id: 'user-A', email: 'a@example.com' });
    h.startAuditForUser.mockResolvedValue({ ok: true, auditId: 'audit-1', domain: 'example.com', executionMode: 'serverless', workerAlive: false });

    await POST(req({ callback_query: { id: 'cb1', from: { id: 'A' }, message: { chat: { id: 'A', type: 'private' } }, data: 'auditrun:example.com' } }));

    expect(h.startAuditForUser).toHaveBeenCalledWith('user-A', 'a@example.com', 'example.com');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', expect.stringMatching(/Audit started/), undefined);
  });

  it('does not start an audit when the user taps Cancel', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    await POST(req({ callback_query: { id: 'cb1', from: { id: 'A' }, message: { chat: { id: 'A', type: 'private' } }, data: 'auditcancel' } }));
    expect(h.startAuditForUser).not.toHaveBeenCalled();
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', 'Cancelled.', undefined);
  });

  it('re-resolves identity from callback_query.from.id — a forged callback cannot start an audit for another user', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null); // attacker has no linked connection
    await POST(req({ callback_query: { id: 'cb1', from: { id: 'attacker' }, message: { chat: { id: 'attacker', type: 'private' } }, data: 'auditrun:victim-owned-site.com' } }));
    expect(h.getConnectionByTelegramUserId).toHaveBeenCalledWith('attacker');
    expect(h.startAuditForUser).not.toHaveBeenCalled();
  });

  it('reports quota-exhausted / already-running failures truthfully rather than pretending success', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getUserById.mockResolvedValue({ id: 'user-A', email: 'a@example.com' });
    h.startAuditForUser.mockResolvedValue({ ok: false, reason: 'credits_denied', message: 'Insufficient credits.' });

    await POST(req({ callback_query: { id: 'cb1', from: { id: 'A' }, message: { chat: { id: 'A', type: 'private' } }, data: 'auditrun:example.com' } }));

    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', 'Insufficient credits.', undefined);
  });
});

describe('POST /api/telegram-user/webhook — /status and /history: real persisted data, user-scoped', () => {
  it('/status reports real persisted status for the requester\'s own domain', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.getLatestAuditByDomain.mockResolvedValue({
      id: 'audit-1', domain: 'example.com', status: 'complete', errorMessage: null,
      createdAt: new Date('2026-01-01T00:00:00Z'), completedAt: new Date('2026-01-01T00:05:00Z'),
    });

    await POST(req({ message: { from: { id: 'A' }, chat: { id: 'A', type: 'private' }, text: '/status example.com' } }));

    expect(h.getLatestAuditByDomain).toHaveBeenCalledWith('example.com', 'user-A');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', expect.stringMatching(/Status: complete/), undefined);
  });

  it('/history lists only the requester\'s own audits — never another user\'s', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, telegramUserId: 'A', siteNexisUserId: 'user-A' });
    h.listAuditsByUser.mockResolvedValue({ data: [{ domain: 'a-owns-this.com', status: 'complete', createdAt: new Date('2026-01-01T00:00:00Z') }], total: 1 });

    await POST(req({ message: { from: { id: 'A' }, chat: { id: 'A', type: 'private' }, text: '/history' } }));

    expect(h.listAuditsByUser).toHaveBeenCalledWith('user-A', 1, 10);
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('A', expect.stringContaining('a-owns-this.com'), undefined);
  });
});
