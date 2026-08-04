import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createHash } from 'crypto';

const h = vi.hoisted(() => ({
  createLinkToken: vi.fn(),
  confirmLinkToken: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  createLinkToken: h.createLinkToken,
  confirmLinkToken: h.confirmLinkToken,
}));

const { startTelegramLink, confirmTelegramLink } = await import('../account-linking');

beforeEach(() => {
  vi.clearAllMocks();
  h.createLinkToken.mockResolvedValue({ id: 'tok-1' });
});

describe('startTelegramLink', () => {
  it('persists only the SHA-256 hash of the token — the raw token is never passed to the DB layer', async () => {
    const { linkUrl } = await startTelegramLink('tg-1', 'chat-1');

    const rawToken = new URL(linkUrl).searchParams.get('token');
    expect(rawToken).toBeTruthy();
    expect(rawToken).toHaveLength(64); // 32 random bytes as hex

    expect(h.createLinkToken).toHaveBeenCalledTimes(1);
    const call = h.createLinkToken.mock.calls[0]![0] as { tokenHash: string; telegramUserId: string; telegramChatId: string };
    expect(call.tokenHash).toBe(createHash('sha256').update(rawToken!).digest('hex'));
    expect(call.tokenHash).not.toBe(rawToken);
  });

  it('sets an expiry roughly 10 minutes out', async () => {
    const before = Date.now();
    const { expiresAt } = await startTelegramLink('tg-1', 'chat-1');
    const deltaMs = expiresAt.getTime() - before;
    expect(deltaMs).toBeGreaterThan(9 * 60_000);
    expect(deltaMs).toBeLessThanOrEqual(10 * 60_000 + 5_000);
  });

  it('generates a fresh random token on every call — no fixed or predictable value', async () => {
    const first = await startTelegramLink('tg-1', 'chat-1');
    const second = await startTelegramLink('tg-1', 'chat-1');
    expect(new URL(first.linkUrl).searchParams.get('token')).not.toBe(new URL(second.linkUrl).searchParams.get('token'));
  });
});

describe('confirmTelegramLink', () => {
  it('hashes the raw token the same way before looking it up — round-trips correctly', async () => {
    h.confirmLinkToken.mockResolvedValue({ success: true });
    const rawToken = 'a'.repeat(64);
    await confirmTelegramLink(rawToken, 'user-1');
    expect(h.confirmLinkToken).toHaveBeenCalledWith(createHash('sha256').update(rawToken).digest('hex'), 'user-1');
  });

  it('passes through a failure reason unmodified', async () => {
    h.confirmLinkToken.mockResolvedValue({ success: false, reason: 'telegram_already_linked' });
    const result = await confirmTelegramLink('a'.repeat(64), 'user-1');
    expect(result).toEqual({ success: false, reason: 'telegram_already_linked' });
  });
});
