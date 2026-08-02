import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  env: {
    CRON_SECRET: 'test-cron-secret',
    TELEGRAM_ALERTS_ENABLED: true,
    TELEGRAM_ADMIN_CHAT_ID: '123456789',
  },
  isTelegramConfigured: vi.fn(),
  sendTelegramMessage: vi.fn(),
  buildDailyDigest: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/telegram-ops/digest', () => ({ buildDailyDigest: h.buildDailyDigest }));
vi.mock('@/lib/telegram-ops/telegram-provider', () => ({
  isTelegramConfigured: h.isTelegramConfigured,
  sendTelegramMessage: h.sendTelegramMessage,
}));

const { GET } = await import('../route');

function req(auth?: string): NextRequest {
  return { headers: new Headers(auth ? { authorization: auth } : {}) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.env.TELEGRAM_ALERTS_ENABLED = true;
  h.isTelegramConfigured.mockReturnValue(true);
  h.buildDailyDigest.mockResolvedValue('digest text');
  h.sendTelegramMessage.mockResolvedValue(true);
});

describe('GET /api/cron/ops-digest', () => {
  it('401s without the correct bearer secret', async () => {
    const res = await GET(req('Bearer wrong'));
    expect(res.status).toBe(401);
  });

  it('sends the built digest to the admin chat', async () => {
    const res = await GET(req('Bearer test-cron-secret'));

    expect(res.status).toBe(200);
    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', 'digest text');
  });

  it('skips without error when Telegram alerts are disabled', async () => {
    h.env.TELEGRAM_ALERTS_ENABLED = false;

    const res = await GET(req('Bearer test-cron-secret'));
    const body = await res.json() as { skipped: boolean };

    expect(body.skipped).toBe(true);
    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('returns 500 (not a throw) when digest generation fails', async () => {
    h.buildDailyDigest.mockRejectedValue(new Error('db down'));

    const res = await GET(req('Bearer test-cron-secret'));

    expect(res.status).toBe(500);
  });
});
