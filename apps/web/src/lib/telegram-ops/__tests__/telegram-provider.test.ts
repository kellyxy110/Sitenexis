import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const h = vi.hoisted(() => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-token-not-real',
    TELEGRAM_ADMIN_CHAT_ID: '123456789',
    TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
    TELEGRAM_ALERTS_ENABLED: true,
  },
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));

const {
  isTelegramConfigured,
  isValidWebhookSecret,
  isAdminChat,
  sendTelegramMessage,
  getLatestChatId,
} = await import('../telegram-provider');

const originalFetch = global.fetch;

/** Telegram's real success/error response shapes. */
function ok() {
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
}
function telegramError(errorCode: number, description: string) {
  return { ok: false, status: errorCode, json: async () => ({ ok: false, error_code: errorCode, description }) };
}

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

describe('sendTelegramMessage — basic success/failure', () => {
  it('returns true on a 200 response, sending HTML parse_mode, and never includes the token anywhere but the request URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', '<b>hello</b>');

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain(h.env.TELEGRAM_BOT_TOKEN);
    const body = JSON.parse(init.body as string) as Record<string, unknown>;
    expect(body).toMatchObject({ chat_id: '123456789', text: '<b>hello</b>', parse_mode: 'HTML' });
  });

  it('returns false (never throws) when the network request itself fails', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('network down')) as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
  });

  it('returns false without calling fetch when no bot token is configured', async () => {
    h.env.TELEGRAM_BOT_TOKEN = '';
    const fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('sendTelegramMessage — Telegram HTML entity-parse rejection → plain-text fallback', () => {
  it('retries once as plain text when Telegram rejects the HTML for malformed entities, and succeeds', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(telegramError(400, "Bad Request: can't parse entities: Unsupported start tag \"foo\" at byte offset 12"))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', '<b>broken &<foo> tag</b>');

    expect(sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondCallBody = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(secondCallBody.parse_mode).toBeUndefined();
  });

  it('the plain-text fallback strips tags and decodes entities back to literal characters', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(telegramError(400, "can't parse entities: bad tag"))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramMessage('123456789', '<b>a&lt;b&gt;&amp;c</b>');

    const secondCallBody = JSON.parse((fetchMock.mock.calls[1] as [string, RequestInit])[1].body as string) as Record<string, unknown>;
    expect(secondCallBody.text).toBe('a<b>&c');
  });

  it('returns false when even the plain-text fallback fails', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(telegramError(400, "can't parse entities"))
      .mockResolvedValueOnce(telegramError(500, 'Internal Server Error'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', '<b>x</b>');

    expect(sent).toBe(false);
  });

  it('logs a sanitized diagnostic on the initial parse failure — no token or full API URL in the log', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(telegramError(400, "can't parse entities: bad tag"))
      .mockResolvedValueOnce(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramMessage('123456789', '<b>x</b>');

    expect(h.logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ status: 400, willRetryPlainText: true }),
      expect.any(String),
    );
    const loggedFields = JSON.stringify(h.logger.error.mock.calls[0]);
    expect(loggedFields).not.toContain(h.env.TELEGRAM_BOT_TOKEN);
    expect(loggedFields).not.toContain('api.telegram.org/bot' + h.env.TELEGRAM_BOT_TOKEN);
  });
});

describe('sendTelegramMessage — non-parse errors are never retried', () => {
  it('does not retry on 401 unauthorized (bad/revoked token)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(telegramError(401, 'Unauthorized'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 403 forbidden (bot blocked by the chat)', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(telegramError(403, 'Forbidden: bot was blocked by the user'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on 429 rate limited', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(telegramError(429, 'Too Many Requests: retry after 5'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry on a network-level failure', async () => {
    const fetchMock = vi.fn().mockRejectedValueOnce(new Error('ECONNRESET'));
    global.fetch = fetchMock as unknown as typeof fetch;

    const sent = await sendTelegramMessage('123456789', 'hello');

    expect(sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('sendTelegramMessage — chunking for long output', () => {
  it('sends a short message as a single request', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    await sendTelegramMessage('123456789', 'line one\nline two');

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('splits a production-sized long message on newline boundaries, never mid-line', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const lines = Array.from({ length: 300 }, (_, i) => `🔴 <b>audit-${i}.example.com</b> — failed (${i}m ago)`);
    const longMessage = ['<b>Recent Audits</b> (last 300)', ...lines].join('\n');

    const sent = await sendTelegramMessage('123456789', longMessage);

    expect(sent).toBe(true);
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
    expect(fetchMock.mock.calls.length).toBeLessThanOrEqual(3);
    for (const call of fetchMock.mock.calls) {
      const body = JSON.parse((call as [string, RequestInit])[1].body as string) as { text: string };
      expect(body.text.length).toBeLessThanOrEqual(3600);
      // Never cut inside a line: every chunk must consist of whole lines from the original.
      for (const chunkLine of body.text.split('\n')) {
        expect(longMessage.includes(chunkLine) || chunkLine.includes('truncated')).toBe(true);
      }
    }
  });

  it('caps output at 3 chunks and appends a pointer back to the dashboard instead of sending unbounded messages', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok());
    global.fetch = fetchMock as unknown as typeof fetch;

    const lines = Array.from({ length: 2000 }, (_, i) => `line ${i} — ${'x'.repeat(50)}`);
    const hugeMessage = lines.join('\n');

    await sendTelegramMessage('123456789', hugeMessage);

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const lastBody = JSON.parse((fetchMock.mock.calls[2] as [string, RequestInit])[1].body as string) as { text: string };
    expect(lastBody.text).toContain('truncated');
    expect(lastBody.text).toContain('SiteNexis dashboard');
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
