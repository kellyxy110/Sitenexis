import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getAggregatedLandingPageMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getAggregatedLandingPageMetrics: h.getAggregatedLandingPageMetrics,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/landing-pages', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await GET(req('https://x.com/api'));
    expect(res.status).toBe(401);
  });

  it('reports not_connected when there is no Google connection', async () => {
    h.getGoogleConnection.mockResolvedValue(null);
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.connector.status).toBe('not_connected');
  });

  it('returns an empty list when no GA4 property is configured', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: null });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.landingPages).toEqual([]);
  });

  it('computes engagement rate as activeUsers/sessions from real synced fields, never inventing a rate', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    h.getAggregatedLandingPageMetrics
      .mockResolvedValueOnce([{ pagePath: '/', sessions: 100, activeUsers: 62, keyEvents: 5, avgEngagementTimeSec: 45 }])
      .mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.landingPages[0].engagementRate).toBeCloseTo(0.62);
  });

  it('reports engagement rate as 0 (not NaN or Infinity) when there are zero sessions', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    h.getAggregatedLandingPageMetrics.mockResolvedValueOnce([{ pagePath: '/empty', sessions: 0, activeUsers: 0, keyEvents: 0, avgEngagementTimeSec: 0 }]).mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.landingPages[0].engagementRate).toBe(0);
    expect(Number.isFinite(json.landingPages[0].engagementRate)).toBe(true);
  });

  it('sorts by sessions descending and caps the result set', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    const many = Array.from({ length: 40 }, (_, i) => ({ pagePath: `/p${i}`, sessions: i, activeUsers: i, keyEvents: 0, avgEngagementTimeSec: 10 }));
    h.getAggregatedLandingPageMetrics.mockResolvedValueOnce(many).mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.landingPages.length).toBeLessThanOrEqual(30);
    expect(json.landingPages[0].pagePath).toBe('/p39');
  });
});
