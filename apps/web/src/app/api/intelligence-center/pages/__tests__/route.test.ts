import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getAggregatedSearchPageStats: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getAggregatedSearchPageStats: h.getAggregatedSearchPageStats,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/pages', () => {
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

  it('returns an empty page list when no GSC site is configured, never an error', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: null });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.pages).toEqual([]);
  });

  it('computes a real period-over-period comparison for each page', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.getAggregatedSearchPageStats
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 120, impressions: 2000, ctr: 0.06, avgPosition: 5 }])
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 80, impressions: 1500, ctr: 0.053, avgPosition: 7 }]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.pages[0].clicksComparison.direction).toBe('up');
    expect(json.pages[0].positionDelta).toBe(2);
  });

  it('never fabricates a comparison for a page with no previous-period data', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.getAggregatedSearchPageStats.mockResolvedValueOnce([{ page: '/new-page', clicks: 10, impressions: 100, ctr: 0.1, avgPosition: 4 }]).mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.pages[0].positionDelta).toBeNull();
  });

  it('sorts pages by impressions descending and caps the result set', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    const many = Array.from({ length: 40 }, (_, i) => ({ page: `/p${i}`, clicks: 1, impressions: i, ctr: 0.01, avgPosition: 10 }));
    h.getAggregatedSearchPageStats.mockResolvedValueOnce(many).mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.pages.length).toBeLessThanOrEqual(30);
    expect(json.pages[0].page).toBe('/p39');
  });
});
