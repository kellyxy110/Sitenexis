import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  exchangeGoogleAuthCode: vi.fn(),
  verifyOAuthState: vi.fn(),
  upsertGoogleConnection: vi.fn(),
  setGoogleConnectionError: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/google/crypto', () => ({ encryptToken: (t: string) => `encrypted:${t}` }));
vi.mock('@/lib/google/oauth-client', () => ({
  exchangeGoogleAuthCode: h.exchangeGoogleAuthCode,
  GOOGLE_OAUTH_SCOPES: [
    'https://www.googleapis.com/auth/analytics.readonly',
    'https://www.googleapis.com/auth/webmasters.readonly',
    'https://www.googleapis.com/auth/userinfo.email',
  ],
}));
vi.mock('@/lib/google/state', () => ({
  verifyOAuthState: h.verifyOAuthState,
  GOOGLE_OAUTH_STATE_COOKIE: 'sn_google_oauth_state',
}));
vi.mock('@sitenexis/db', () => ({
  upsertGoogleConnection: h.upsertGoogleConnection,
  setGoogleConnectionError: h.setGoogleConnectionError,
}));

const { GET } = await import('../route');

function req(params: Record<string, string> = {}): NextRequest {
  const url = new URL('https://sitenexis.vercel.app/api/integrations/google/callback');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return {
    url: url.toString(),
    cookies: { get: () => ({ value: 'valid-state-cookie' }) },
  } as unknown as NextRequest;
}

const FULL_SCOPES = [
  'https://www.googleapis.com/auth/analytics.readonly',
  'https://www.googleapis.com/auth/webmasters.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
];

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
  h.verifyOAuthState.mockReturnValue(true);
});

describe('GET /api/integrations/google/callback', () => {
  it('redirects to ?connected=google when all required scopes were granted', async () => {
    h.exchangeGoogleAuthCode.mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(), scopes: FULL_SCOPES,
      googleAccountEmail: 'test@example.com',
    });

    const res = await GET(req({ code: 'auth-code', state: 'valid-state-cookie' }));

    expect(h.upsertGoogleConnection).toHaveBeenCalledOnce();
    expect(h.setGoogleConnectionError).not.toHaveBeenCalled();
    expect(res.headers.get('location')).toContain('connected=google');
  });

  it('marks the connection as errored and redirects with insufficient_scopes when Analytics/Search Console scopes are missing', async () => {
    h.exchangeGoogleAuthCode.mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(),
      scopes: ['https://www.googleapis.com/auth/userinfo.email', 'openid'], // exactly the real-world failure mode
      googleAccountEmail: 'test@example.com',
    });

    const res = await GET(req({ code: 'auth-code', state: 'valid-state-cookie' }));

    expect(h.upsertGoogleConnection).toHaveBeenCalledOnce(); // still recorded — we know who tried and which email
    expect(h.setGoogleConnectionError).toHaveBeenCalledWith(
      'user-1',
      'error',
      expect.stringContaining('analytics.readonly'),
    );
    expect(res.headers.get('location')).toContain('google_error=insufficient_scopes');
  });

  it('does not flag missing scopes when only the Search Console scope is granted', async () => {
    h.exchangeGoogleAuthCode.mockResolvedValue({
      accessToken: 'at', refreshToken: 'rt', expiresAt: new Date(),
      scopes: ['https://www.googleapis.com/auth/webmasters.readonly', 'https://www.googleapis.com/auth/userinfo.email'],
      googleAccountEmail: 'test@example.com',
    });

    const res = await GET(req({ code: 'auth-code', state: 'valid-state-cookie' }));

    expect(h.setGoogleConnectionError).toHaveBeenCalledWith(
      'user-1', 'error', expect.stringContaining('analytics.readonly'),
    );
    expect(res.headers.get('location')).toContain('google_error=insufficient_scopes');
  });

  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('redirects with invalid_state when the CSRF state check fails', async () => {
    h.verifyOAuthState.mockReturnValue(false);
    const res = await GET(req({ code: 'auth-code', state: 'wrong' }));
    expect(res.headers.get('location')).toContain('google_error=invalid_state');
    expect(h.exchangeGoogleAuthCode).not.toHaveBeenCalled();
  });

  it('redirects with the passthrough error when Google reports ?error=access_denied', async () => {
    const res = await GET(req({ error: 'access_denied' }));
    expect(res.headers.get('location')).toContain('google_error=access_denied');
    expect(h.exchangeGoogleAuthCode).not.toHaveBeenCalled();
  });

  it('redirects with exchange_failed when the token exchange throws', async () => {
    h.exchangeGoogleAuthCode.mockRejectedValue(new Error('boom'));
    const res = await GET(req({ code: 'auth-code', state: 'valid-state-cookie' }));
    expect(res.headers.get('location')).toContain('google_error=exchange_failed');
  });
});
