import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getValidAccessToken: vi.fn(),
  setGoogleConnectionProperties: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/google/token-manager', () => ({
  getValidAccessToken: h.getValidAccessToken,
  GoogleTokenError: class GoogleTokenError extends Error {},
}));
vi.mock('@/lib/google/oauth-client', () => ({ clientWithAccessToken: () => ({}) }));
vi.mock('googleapis', () => ({
  google: {
    analyticsadmin: () => ({ accountSummaries: { list: async () => ({ data: { accountSummaries: [] } }) } }),
    searchconsole: () => ({ sites: { list: async () => ({ data: { siteEntry: [] } }) } }),
  },
}));
vi.mock('@sitenexis/db', () => ({ setGoogleConnectionProperties: h.setGoogleConnectionProperties }));

const { POST } = await import('../route');

function postReq(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
});

describe('POST /api/integrations/google/properties', () => {
  it('saving only a GA4 property does not send gscSiteUrl/gscSiteName at all', async () => {
    await POST(postReq({ ga4PropertyId: 'p1', ga4PropertyName: 'My Property' }));

    expect(h.setGoogleConnectionProperties).toHaveBeenCalledWith('user-1', {
      ga4PropertyId: 'p1',
      ga4PropertyName: 'My Property',
    });
  });

  it('saving only a Search Console site does not send ga4PropertyId/ga4PropertyName at all', async () => {
    await POST(postReq({ gscSiteUrl: 'https://sitenexis.vercel.app/', gscSiteName: 'https://sitenexis.vercel.app/' }));

    expect(h.setGoogleConnectionProperties).toHaveBeenCalledWith('user-1', {
      gscSiteUrl: 'https://sitenexis.vercel.app/',
      gscSiteName: 'https://sitenexis.vercel.app/',
    });
  });

  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await POST(postReq({ ga4PropertyId: 'p1' }));
    expect(res.status).toBe(401);
  });

  it('400 on invalid JSON', async () => {
    const req = { json: async () => { throw new Error('bad json'); } } as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
