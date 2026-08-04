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

describe('notifyOps — AUDIT_COMPLETE rich formatting', () => {
  function completeEvent(metadata: Record<string, string | number | boolean | null>): OperationalEvent {
    return {
      type: 'AUDIT_COMPLETE',
      summary: 'Audit for example.com completed.',
      dedupeKey: 'audit-complete:a1',
      occurredAt: new Date().toISOString(),
      metadata,
    };
  }

  it('renders domain, status, and real scores', async () => {
    await notifyOps(completeEvent({ domain: 'truvyx.org', status: 'complete', aiVisibility: 87, technicalSeo: 98, machineTrust: 39, reportStatus: 'ready' }));

    const [, text] = h.sendTelegramMessage.mock.calls[0]!;
    expect(text).toContain('truvyx.org');
    expect(text).toContain('AI Visibility: 87/100');
    expect(text).toContain('Technical SEO: 98/100');
    expect(text).toContain('Machine Trust: 39/100');
  });

  it('shows "Ready" when the report generated, "Processing" when it has not', async () => {
    await notifyOps(completeEvent({ domain: 'truvyx.org', status: 'complete', reportStatus: 'ready' }));
    expect(h.sendTelegramMessage.mock.calls[0]![1]).toContain('Intelligence Report: Ready');

    vi.clearAllMocks();
    h.shouldSuppressDuplicate.mockResolvedValue(false);
    h.sendTelegramMessage.mockResolvedValue(true);
    await notifyOps(completeEvent({ domain: 'truvyx.org', status: 'complete', reportStatus: 'processing' }));
    expect(h.sendTelegramMessage.mock.calls[0]![1]).toContain('Intelligence Report: Processing');
  });

  it('never fabricates an executive assessment when the report is still processing', async () => {
    await notifyOps(completeEvent({ domain: 'truvyx.org', status: 'complete', reportStatus: 'processing' }));

    const text = h.sendTelegramMessage.mock.calls[0]![1] as string;
    expect(text).not.toContain('Executive Assessment');
  });

  it('HTML-escapes a domain value before it reaches Telegram', async () => {
    await notifyOps(completeEvent({ domain: 'evil<script>&.com', status: 'complete', reportStatus: 'ready' }));

    const text = h.sendTelegramMessage.mock.calls[0]![1] as string;
    expect(text).not.toContain('<script>');
    expect(text).toContain('evil&lt;script&gt;&amp;.com');
  });

  it('includes the view URL and follow-up commands when provided', async () => {
    await notifyOps(completeEvent({ domain: 'truvyx.org', status: 'complete', reportStatus: 'ready', viewUrl: 'https://sitenexis.vercel.app/audit/truvyx.org' }));

    const text = h.sendTelegramMessage.mock.calls[0]![1] as string;
    expect(text).toContain('https://sitenexis.vercel.app/audit/truvyx.org');
    expect(text).toContain('/audit truvyx.org');
    expect(text).toContain('/report truvyx.org');
  });
});
