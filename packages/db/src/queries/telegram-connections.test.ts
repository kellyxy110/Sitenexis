import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  linkTokenFindUnique: vi.fn(),
  linkTokenUpdate: vi.fn(),
  linkTokenCreate: vi.fn(),
  connectionFindUnique: vi.fn(),
  connectionUpdate: vi.fn(),
  connectionCreate: vi.fn(),
  eventCreate: vi.fn(),
  auditFindMany: vi.fn(),
}));

vi.mock('../client', () => ({
  db: {
    telegramLinkToken: {
      findUnique: h.linkTokenFindUnique,
      update: h.linkTokenUpdate,
      create: h.linkTokenCreate,
    },
    telegramConnection: {
      findUnique: h.connectionFindUnique,
      update: h.connectionUpdate,
      create: h.connectionCreate,
    },
    telegramConnectionEvent: { create: h.eventCreate },
    audit: { findMany: h.auditFindMany },
    $transaction: vi.fn(async (cb: (tx: unknown) => unknown) => cb({
      telegramLinkToken: { findUnique: h.linkTokenFindUnique, update: h.linkTokenUpdate },
      telegramConnection: { findUnique: h.connectionFindUnique, update: h.connectionUpdate, create: h.connectionCreate },
      telegramConnectionEvent: { create: h.eventCreate },
    })),
  },
}));

import { confirmLinkToken, disconnectConnection, getUserWebsiteDomains } from './telegram-connections';

beforeEach(() => {
  vi.clearAllMocks();
  h.eventCreate.mockResolvedValue({});
});

describe('confirmLinkToken', () => {
  const futureExpiry = new Date(Date.now() + 5 * 60_000);
  const pastExpiry = new Date(Date.now() - 5 * 60_000);
  const baseToken = { id: 'tok-1', tokenHash: 'hash-1', telegramUserId: 'tg-1', telegramChatId: 'chat-1', consumedAt: null, expiresAt: futureExpiry };

  it('rejects an unknown token hash', async () => {
    h.linkTokenFindUnique.mockResolvedValue(null);
    const result = await confirmLinkToken('nonexistent-hash', 'user-1');
    expect(result).toEqual({ success: false, reason: 'invalid_or_expired' });
  });

  it('rejects an expired token', async () => {
    h.linkTokenFindUnique.mockResolvedValue({ ...baseToken, expiresAt: pastExpiry });
    const result = await confirmLinkToken('hash-1', 'user-1');
    expect(result).toEqual({ success: false, reason: 'invalid_or_expired' });
  });

  it('rejects a token that was already consumed — cannot be replayed', async () => {
    h.linkTokenFindUnique.mockResolvedValue({ ...baseToken, consumedAt: new Date() });
    const result = await confirmLinkToken('hash-1', 'user-1');
    expect(result).toEqual({ success: false, reason: 'already_consumed' });
    expect(h.connectionCreate).not.toHaveBeenCalled();
  });

  it('rejects when the Telegram identity is already linked to a different SiteNexis user', async () => {
    h.linkTokenFindUnique.mockResolvedValue(baseToken);
    h.connectionFindUnique.mockImplementation(({ where }: { where: { telegramUserId?: string; siteNexisUserId?: string } }) => {
      if (where.telegramUserId) return Promise.resolve({ id: 'conn-existing', telegramUserId: 'tg-1', siteNexisUserId: 'user-B' });
      return Promise.resolve(null);
    });
    const result = await confirmLinkToken('hash-1', 'user-A');
    expect(result).toEqual({ success: false, reason: 'telegram_already_linked' });
    expect(h.connectionCreate).not.toHaveBeenCalled();
  });

  it('rejects when the SiteNexis user already has a different linked Telegram identity', async () => {
    h.linkTokenFindUnique.mockResolvedValue(baseToken);
    h.connectionFindUnique.mockImplementation(({ where }: { where: { telegramUserId?: string; siteNexisUserId?: string } }) => {
      if (where.telegramUserId) return Promise.resolve(null);
      if (where.siteNexisUserId) return Promise.resolve({ id: 'conn-other', telegramUserId: 'tg-OTHER', siteNexisUserId: 'user-1' });
      return Promise.resolve(null);
    });
    const result = await confirmLinkToken('hash-1', 'user-1');
    expect(result).toEqual({ success: false, reason: 'sitenexis_already_linked' });
    expect(h.connectionCreate).not.toHaveBeenCalled();
  });

  it('succeeds and creates a new connection for a genuinely new pairing', async () => {
    h.linkTokenFindUnique.mockResolvedValue(baseToken);
    h.connectionFindUnique.mockResolvedValue(null);
    h.connectionCreate.mockResolvedValue({ id: 'conn-new', telegramUserId: 'tg-1', siteNexisUserId: 'user-1' });
    h.linkTokenUpdate.mockResolvedValue({});

    const result = await confirmLinkToken('hash-1', 'user-1');

    expect(result).toEqual({ success: true, connectionId: 'conn-new' });
    expect(h.connectionCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ telegramUserId: 'tg-1', siteNexisUserId: 'user-1', status: 'linked' }),
    }));
    expect(h.linkTokenUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'tok-1' },
      data: expect.objectContaining({ consumedAt: expect.any(Date), telegramConnectionId: 'conn-new' }),
    }));
  });

  it('reactivates (not duplicates) a disconnected connection when the same pair re-links', async () => {
    h.linkTokenFindUnique.mockResolvedValue(baseToken);
    h.connectionFindUnique.mockImplementation(({ where }: { where: { telegramUserId?: string; siteNexisUserId?: string } }) => {
      if (where.telegramUserId) return Promise.resolve({ id: 'conn-1', telegramUserId: 'tg-1', siteNexisUserId: 'user-1', status: 'disconnected' });
      return Promise.resolve({ id: 'conn-1', telegramUserId: 'tg-1', siteNexisUserId: 'user-1', status: 'disconnected' });
    });
    h.connectionUpdate.mockResolvedValue({ id: 'conn-1' });

    const result = await confirmLinkToken('hash-1', 'user-1');

    expect(result).toEqual({ success: true, connectionId: 'conn-1' });
    expect(h.connectionUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 'conn-1' },
      data: expect.objectContaining({ status: 'linked' }),
    }));
    expect(h.connectionCreate).not.toHaveBeenCalled();
  });
});

describe('disconnectConnection', () => {
  it('does nothing when there is no connection', async () => {
    h.connectionFindUnique.mockResolvedValue(null);
    const result = await disconnectConnection('user-1');
    expect(result).toBe(false);
    expect(h.connectionUpdate).not.toHaveBeenCalled();
  });

  it('marks a linked connection disconnected', async () => {
    h.connectionFindUnique.mockResolvedValue({ id: 'conn-1', telegramUserId: 'tg-1', siteNexisUserId: 'user-1', status: 'linked' });
    h.connectionUpdate.mockResolvedValue({});
    const result = await disconnectConnection('user-1');
    expect(result).toBe(true);
    expect(h.connectionUpdate).toHaveBeenCalledWith({ where: { id: 'conn-1' }, data: { status: 'disconnected' } });
  });
});

describe('getUserWebsiteDomains', () => {
  it('scopes strictly to the given userId — no cross-user lookup path exists', async () => {
    h.auditFindMany.mockResolvedValue([
      { id: 'a1', domain: 'user1-site.com', status: 'complete', createdAt: new Date('2026-01-02') },
    ]);
    await getUserWebsiteDomains('user-1');
    expect(h.auditFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 'user-1', archivedAt: null } }));
  });

  it('de-duplicates to the most recent audit per domain', async () => {
    h.auditFindMany.mockResolvedValue([
      { id: 'a2', domain: 'example.com', status: 'complete', createdAt: new Date('2026-02-01') },
      { id: 'a1', domain: 'example.com', status: 'partial', createdAt: new Date('2026-01-01') },
    ]);
    const result = await getUserWebsiteDomains('user-1');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ domain: 'example.com', latestAuditId: 'a2' });
  });
});
