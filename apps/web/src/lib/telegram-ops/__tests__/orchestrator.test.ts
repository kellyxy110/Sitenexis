import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { OperationalEvent } from '../types';

const h = vi.hoisted(() => ({
  env: { TELEGRAM_ALERTS_ENABLED: true, TELEGRAM_ADMIN_CHAT_ID: '123456789' },
  isTelegramConfigured: vi.fn(),
  sendTelegramMessage: vi.fn(),
  shouldSuppressDuplicate: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('../telegram-provider', () => ({
  isTelegramConfigured: h.isTelegramConfigured,
  sendTelegramMessage: h.sendTelegramMessage,
}));
vi.mock('../dedup', () => ({ shouldSuppressDuplicate: h.shouldSuppressDuplicate }));

const { notifyOps } = await import('../orchestrator');

function event(overrides: Partial<OperationalEvent> = {}): OperationalEvent {
  return {
    type: 'AUDIT_FAILED',
    summary: 'test failure',
    dedupeKey: 'k1',
    occurredAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.env.TELEGRAM_ALERTS_ENABLED = true;
  h.isTelegramConfigured.mockReturnValue(true);
  h.shouldSuppressDuplicate.mockResolvedValue(false);
  h.sendTelegramMessage.mockResolvedValue(true);
});

describe('notifyOps', () => {
  it('sends a message when alerts are enabled, configured, and not a duplicate', async () => {
    await notifyOps(event());

    expect(h.sendTelegramMessage).toHaveBeenCalledTimes(1);
    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', expect.stringContaining('test failure'));
  });

  it('does nothing when TELEGRAM_ALERTS_ENABLED is false', async () => {
    h.env.TELEGRAM_ALERTS_ENABLED = false;

    await notifyOps(event());

    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('does nothing when Telegram is not configured', async () => {
    h.isTelegramConfigured.mockReturnValue(false);

    await notifyOps(event());

    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('does not send a duplicate within the dedupe window', async () => {
    h.shouldSuppressDuplicate.mockResolvedValue(true);

    await notifyOps(event());

    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('never throws even when sendTelegramMessage rejects — a Telegram failure must never fail the caller', async () => {
    h.sendTelegramMessage.mockRejectedValue(new Error('Telegram API down'));

    await expect(notifyOps(event())).resolves.toBeUndefined();
  });

  it('never throws even when the dedupe check itself throws', async () => {
    h.shouldSuppressDuplicate.mockRejectedValue(new Error('Redis down'));

    await expect(notifyOps(event())).resolves.toBeUndefined();
  });

  it('includes the detail line in the message when provided', async () => {
    await notifyOps(event({ detail: 'extra context here' }));

    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', expect.stringContaining('extra context here'));
  });
});
