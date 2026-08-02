import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  isValidWebhookSecret: vi.fn(),
  isAdminChat: vi.fn(),
  sendTelegramMessage: vi.fn(),
  statusHandler: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/telegram-ops/telegram-provider', () => ({
  isValidWebhookSecret: h.isValidWebhookSecret,
  isAdminChat: h.isAdminChat,
  sendTelegramMessage: h.sendTelegramMessage,
}));
vi.mock('@/lib/telegram-ops/commands', () => ({
  COMMANDS: { '/status': h.statusHandler },
}));

const { POST } = await import('../route');

function req(body: unknown, secretHeader?: string): NextRequest {
  return {
    headers: new Headers(secretHeader != null ? { 'x-telegram-bot-api-secret-token': secretHeader } : {}),
    json: async () => body,
  } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.isValidWebhookSecret.mockReturnValue(true);
  h.isAdminChat.mockReturnValue(true);
  h.sendTelegramMessage.mockResolvedValue(true);
  h.statusHandler.mockResolvedValue('status ok');
});

describe('POST /api/telegram/webhook', () => {
  it('401s when the webhook secret header is invalid', async () => {
    h.isValidWebhookSecret.mockReturnValue(false);

    const res = await POST(req({}, 'wrong'));

    expect(res.status).toBe(401);
    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('silently ignores commands from a non-admin chat (no reply sent, no error)', async () => {
    h.isAdminChat.mockReturnValue(false);

    const res = await POST(req({ message: { chat: { id: 999 }, text: '/status' } }, 'secret'));

    expect(res.status).toBe(200);
    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('dispatches a known command to its handler and replies with the result', async () => {
    const res = await POST(req({ message: { chat: { id: 123456789 }, text: '/status' } }, 'secret'));

    expect(res.status).toBe(200);
    expect(h.statusHandler).toHaveBeenCalledTimes(1);
    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', 'status ok');
  });

  it('strips a trailing @BotName suffix before matching the command', async () => {
    await POST(req({ message: { chat: { id: 123456789 }, text: '/status@SiteNexisOpsBot' } }, 'secret'));

    expect(h.statusHandler).toHaveBeenCalledTimes(1);
  });

  it('replies with help text for an unrecognized command instead of erroring', async () => {
    await POST(req({ message: { chat: { id: 123456789 }, text: '/nonexistent' } }, 'secret'));

    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', expect.stringContaining('/status'));
  });

  it('replies with a failure notice instead of throwing when a command handler rejects', async () => {
    h.statusHandler.mockRejectedValue(new Error('db down'));

    const res = await POST(req({ message: { chat: { id: 123456789 }, text: '/status' } }, 'secret'));

    expect(res.status).toBe(200);
    expect(h.sendTelegramMessage).toHaveBeenCalledWith('123456789', expect.stringContaining('failed'));
  });

  it('returns 200 without doing anything for a non-message update (e.g. no text)', async () => {
    const res = await POST(req({ message: { chat: { id: 123456789 } } }, 'secret'));

    expect(res.status).toBe(200);
    expect(h.sendTelegramMessage).not.toHaveBeenCalled();
  });

  it('returns 200 for unparseable JSON bodies instead of throwing', async () => {
    const badReq = {
      headers: new Headers({ 'x-telegram-bot-api-secret-token': 'secret' }),
      json: async () => { throw new Error('bad json'); },
    } as unknown as NextRequest;

    const res = await POST(badReq);

    expect(res.status).toBe(200);
  });
});
