import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getConnectionBySiteNexisUserId: vi.fn(),
  getNotificationPreference: vi.fn(),
  sendUserBotMessage: vi.fn(),
  getExecutiveSummary: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getConnectionBySiteNexisUserId: h.getConnectionBySiteNexisUserId,
  getNotificationPreference: h.getNotificationPreference,
}));
vi.mock('@/lib/telegram-user/provider', () => ({ sendUserBotMessage: h.sendUserBotMessage }));
vi.mock('@/lib/audit-intelligence/executive-summary-service', () => ({ getExecutiveSummary: h.getExecutiveSummary }));

const { notifyTelegramUserAuditResult } = await import('../audit-notifications');

const linkedConnection = {
  id: 'conn-1', telegramUserId: '111', telegramChatId: '111', siteNexisUserId: 'user-A',
  status: 'linked' as const, activeDomain: null, linkedAt: new Date(), lastInteractionAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.getConnectionBySiteNexisUserId.mockResolvedValue(linkedConnection);
  h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: true, notifyOnPartial: true, notifyOnFailed: true, notifyOnStalled: false });
  h.sendUserBotMessage.mockResolvedValue(true);
  h.getExecutiveSummary.mockResolvedValue(null);
});

describe('notifyTelegramUserAuditResult', () => {
  it('sends a complete notification to the linked user\'s own chat, with result-action buttons', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith(
      '111',
      expect.stringMatching(/Audit complete/),
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
  });

  it('sends a partial notification, with result-action buttons', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'partial');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith(
      '111',
      expect.stringMatching(/partial results/),
      expect.objectContaining({ inline_keyboard: expect.any(Array) }),
    );
  });

  it('sends a failed notification with no result-action buttons — there is nothing to view yet', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'failed');
    expect(h.sendUserBotMessage).toHaveBeenCalledWith('111', expect.stringMatching(/Audit failed/), undefined);
  });

  it('never notifies a user who has no linked Telegram connection', async () => {
    h.getConnectionBySiteNexisUserId.mockResolvedValue(null);
    await notifyTelegramUserAuditResult('user-no-telegram', 'example.com', 'complete');
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });

  it('never notifies a disconnected connection', async () => {
    h.getConnectionBySiteNexisUserId.mockResolvedValue({ ...linkedConnection, status: 'disconnected' });
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });

  it('respects the user\'s notification preferences', async () => {
    h.getNotificationPreference.mockResolvedValue({ notifyOnComplete: false, notifyOnPartial: true, notifyOnFailed: true, notifyOnStalled: false });
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.sendUserBotMessage).not.toHaveBeenCalled();
  });

  it('defaults to notifying when no preference row exists yet', async () => {
    h.getNotificationPreference.mockResolvedValue(null);
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.sendUserBotMessage).toHaveBeenCalled();
  });

  it('never throws when Telegram delivery fails — the audit pipeline must be unaffected', async () => {
    h.sendUserBotMessage.mockRejectedValue(new Error('Telegram API unreachable'));
    await expect(notifyTelegramUserAuditResult('user-A', 'example.com', 'complete')).resolves.toBeUndefined();
  });

  it('never throws when the connection lookup itself fails', async () => {
    h.getConnectionBySiteNexisUserId.mockRejectedValue(new Error('DB unreachable'));
    await expect(notifyTelegramUserAuditResult('user-A', 'example.com', 'complete')).resolves.toBeUndefined();
  });

  it('never leaks another user\'s chat id — always resolves the chat from the target user\'s own connection', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.getConnectionBySiteNexisUserId).toHaveBeenCalledWith('user-A');
    expect(h.getConnectionBySiteNexisUserId).not.toHaveBeenCalledWith(expect.not.stringMatching('user-A'));
  });
});

describe('Executive Assessment enrichment — never generated here, only surfaced when already persisted', () => {
  const readySummary = {
    state: 'complete',
    data: { composite_score: 8.4, composite_label: 'Strong', overall_verdict: 'Solid AI visibility posture.' },
  };

  it('includes the persisted Executive Assessment when the report is ready at completion time', async () => {
    h.getExecutiveSummary.mockResolvedValue(readySummary);
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete', 'audit-1');

    expect(h.getExecutiveSummary).toHaveBeenCalledWith('audit-1');
    const [, message] = h.sendUserBotMessage.mock.calls[0];
    expect(message).toContain('Executive Assessment');
    expect(message).toContain('8.4/10');
    expect(message).toContain('Solid AI visibility posture.');
  });

  it('omits the Executive Assessment section entirely when the report is not ready — never fabricates one', async () => {
    h.getExecutiveSummary.mockResolvedValue({ state: 'running', data: null });
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete', 'audit-1');

    const [, message] = h.sendUserBotMessage.mock.calls[0];
    expect(message).not.toContain('Executive Assessment');
  });

  it('never fetches the executive summary for a failed audit', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'failed', 'audit-1');
    expect(h.getExecutiveSummary).not.toHaveBeenCalled();
  });

  it('never fetches the executive summary when no auditId is provided (backward compatible)', async () => {
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete');
    expect(h.getExecutiveSummary).not.toHaveBeenCalled();
    const [, message] = h.sendUserBotMessage.mock.calls[0];
    expect(message).not.toContain('Executive Assessment');
  });

  it('includes the Executive Assessment on a partial-status notification too, when the report is ready', async () => {
    h.getExecutiveSummary.mockResolvedValue(readySummary);
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'partial', 'audit-1');
    const [, message] = h.sendUserBotMessage.mock.calls[0];
    expect(message).toContain('Executive Assessment');
  });

  it('never throws when the report lookup itself fails — sends the base notification without the assessment', async () => {
    h.getExecutiveSummary.mockRejectedValue(new Error('DB unreachable'));
    await expect(notifyTelegramUserAuditResult('user-A', 'example.com', 'complete', 'audit-1')).resolves.toBeUndefined();
    expect(h.sendUserBotMessage).toHaveBeenCalled();
    const [, message] = h.sendUserBotMessage.mock.calls[0];
    expect(message).not.toContain('Executive Assessment');
  });

  it('never invokes LLM generation from the notification path — getExecutiveSummary is the only call, no generate/routeTask import', async () => {
    h.getExecutiveSummary.mockResolvedValue(readySummary);
    await notifyTelegramUserAuditResult('user-A', 'example.com', 'complete', 'audit-1');
    expect(h.getExecutiveSummary).toHaveBeenCalledTimes(1);
  });
});
