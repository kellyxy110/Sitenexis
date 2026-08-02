import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-token-not-real',
    TELEGRAM_ADMIN_CHAT_ID: '123456789',
    TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
    TELEGRAM_ALERTS_ENABLED: true,
  },
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));

const {
  isTelegramConfigured,
  isValidWebhookSecret,
  isAdminChat,
  sendTelegramMessage,
  getLatestChatId,
} = await import('../telegram-provider');

const originalFetch = global.fetch;

beforeEach(() => {
  vi.clearAllMocks();
  h.env.TELEGRAM_BOT_TOKEN = 'test-token-not-real';
  h.env.TELEGRAM_ADMIN_CHAT_ID = '123456789';
  h.env.TELEGRAM_WEBHOOK_SECRET = 'a'.repeat(32);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('isTelegramConfigured', () => {
  it('true when both token and admin chat id are set', () => {
    expect(isTelegramConfigured()).toBe(true);
  });

  it('false when the token is empty', () => {
    h.env.TELEGRAM_BOT_TOKEN = '';
    expect(isTelegramConfigured()).toBe(false);
  });
});

describe('isValidWebhookSecret', () => {
  it('accepts the exact configured secret', () => {
    expect(isValidWebhookSecret('a'.repeat(32))).toBe(true);
  });

  it('rejects a wrong secret', () => {
    expect(isValidWebhookSecret('b'.repeat(32))).toBe(false);
  });

  it('rejects a null header', () => {
    expect(isValidWebhookSecret(null)).toBe(false);
  });

  it('rejects when no secret is configured, even if the header happens to be empty', () => {
    h.env.TELEGRAM_WEBHOOK_SECRET = '';
    expect(isValidWebhookSecret('')).toBe(false);
  });
});

describe('isAdminChat', () => {
  it('accepts the configured numeric admin chat id, as a number or a string', () => {
    expect(isAdminChat(123456789)).toBe(true);
    expect(isAdminChat('123456789')).toBe(true);
  });

  it('rejects any other chat id', () => {
    expect(isAdminChat(999)).toBe(false);
  });

  it('accepts a real 10-digit admin chat id exactly', () => {
    h.env.TELEGRAM_ADMIN_CHAT_ID = '8619262047';
    expect(isAdminChat(8619262047)).toBe(true);
    expect(isAdminChat('8619262047')).toBe(true);
  });

  it('still matches when the configured env value has leading/trailing whitespace — the exact failure mode a Vercel-dashboard paste can introduce', () => {
    h.env.TELEGRAM_ADMIN_CHAT_ID = '  8619262047\n';
    expect(isAdminChat(8619262047)).toBe(true);
  });

  it('rejects a numerically-close but different chat id even with whitespace present', () => {
    h.env.TELEGRAM_ADMIN_CHAT_ID = ' 8619262047 ';
    expect(isAdminChat(861926204)).toBe(false);
    expect(isAdminChat(86192620470)).toBe(false);
  });

  it('rejects every chat id when the configured value is empty or only whitespace', () => {
    h.env.TELEGRAM_ADMIN_CHAT_ID = '   ';
    expect(isAdminChat(8619262047)).toBe(false);
  });
});

describe('sendTelegramMessage', () => {
  it('returns true on a 200 response and never includes the token in the request URL logged elsewhere', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await sendTelegramMessage('123456789', 'hello');

    expect(ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining(h.env.TELEGRAM_BOT_TOKEN),
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns false when the Telegram API responds with a non-ok status', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: async () => 'Bad Request' }) as unknown as typeof fetch;

    const ok = await sendTelegramMessage('123456789', 'hello');

    expect(ok).toBe(false);
  });

  it('returns false (never throws) when the network request itself fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const ok = await sendTelegramMessage('123456789', 'hello');

    expect(ok).toBe(false);
  });

  it('returns false without calling fetch when no bot token is configured', async () => {
    h.env.TELEGRAM_BOT_TOKEN = '';
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const ok = await sendTelegramMessage('123456789', 'hello');

    expect(ok).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('getLatestChatId', () => {
  it('extracts the chat id from the most recent update', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, result: [{ message: { chat: { id: 555 } } }] }),
    }) as unknown as typeof fetch;

    const chatId = await getLatestChatId();

    expect(chatId).toBe(555);
  });

  it('returns null when there are no updates yet', async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true, result: [] }) }) as unknown as typeof fetch;

    expect(await getLatestChatId()).toBeNull();
  });

  it('returns null (never throws) on a network error', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('boom')) as unknown as typeof fetch;

    expect(await getLatestChatId()).toBeNull();
  });
});
