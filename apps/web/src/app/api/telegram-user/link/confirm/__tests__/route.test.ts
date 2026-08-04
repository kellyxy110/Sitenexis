import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimit: vi.fn(),
  confirmTelegramLink: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/telegram-user/account-linking', () => ({ confirmTelegramLink: h.confirmTelegramLink }));

const { POST } = await import('../route');

function req(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.rateLimit.mockResolvedValue({ ok: true, headers: {} });
});

describe('POST /api/telegram-user/link/confirm', () => {
  it('401s when there is no authenticated SiteNexis session — this is the only entry point that can create a link', async () => {
    h.requireAuth.mockRejectedValue(new Error('no session'));
    const res = await POST(req({ token: 'a'.repeat(64) }));
    expect(res.status).toBe(401);
    expect(h.confirmTelegramLink).not.toHaveBeenCalled();
  });

  it('400s on a missing/malformed token without ever calling the linking service', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    const res = await POST(req({ token: 'too-short' }));
    expect(res.status).toBe(400);
    expect(h.confirmTelegramLink).not.toHaveBeenCalled();
  });

  it('passes the authenticated userId — never a client-supplied id — to the linking service', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    h.confirmTelegramLink.mockResolvedValue({ success: true });
    await POST(req({ token: 'a'.repeat(64) }));
    expect(h.confirmTelegramLink).toHaveBeenCalledWith('a'.repeat(64), 'user-1');
  });

  it('surfaces a replay/expiry failure as a clean 409, never a raw error', async () => {
    h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
    h.confirmTelegramLink.mockResolvedValue({ success: false, reason: 'already_consumed' });
    const res = await POST(req({ token: 'a'.repeat(64) }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.reason).toBe('already_consumed');
    expect(body.error).not.toMatch(/stack|Error:/i);
  });
});
