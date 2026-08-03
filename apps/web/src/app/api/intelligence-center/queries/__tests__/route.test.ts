import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getAggregatedSearchQueryMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getAggregatedSearchQueryMetrics: h.getAggregatedSearchQueryMetrics,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/queries', () => {
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

  it('short-circuits on a non-connected status without querying metrics', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'pending' });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.connector.status).toBe('pending');
    expect(h.getAggregatedSearchQueryMetrics).not.toHaveBeenCalled();
  });

  it('reports empty groups when no GSC site is configured', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: null });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.groups).toBeNull();
    expect(h.getAggregatedSearchQueryMetrics).not.toHaveBeenCalled();
  });

  it('reports empty groups (not an error) when there is no query data for the period', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.getAggregatedSearchQueryMetrics.mockResolvedValue([]);
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.totalQueries).toBe(0);
    expect(json.groups).toBeNull();
  });

  it('classifies real query rows into groups, comparing current vs previous period', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.getAggregatedSearchQueryMetrics
      .mockResolvedValueOnce([{ query: 'ai visibility audit', clicks: 40, impressions: 1200, ctr: 0.033, avgPosition: 8 }])
      .mockResolvedValueOnce([{ query: 'ai visibility audit', clicks: 30, impressions: 800, ctr: 0.0375, avgPosition: 9 }]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.totalQueries).toBe(1);
    expect(json.groups.rising.map((q: { query: string }) => q.query)).toContain('ai visibility audit');
  });

  it('respects a custom period-days query param, clamped to a sane range', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.getAggregatedSearchQueryMetrics.mockResolvedValue([]);

    const res = await GET(req('https://x.com/api?days=9999'));
    const json = await res.json();

    expect(json.periodDays).toBe(90);
  });

  it('caps each group at 20 results', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    const many = Array.from({ length: 30 }, (_, i) => ({ query: `q${i}`, clicks: 5, impressions: 2000, ctr: 0.01, avgPosition: 12 }));
    h.getAggregatedSearchQueryMetrics.mockResolvedValueOnce(many).mockResolvedValueOnce([]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.groups.near_page_one.length).toBeLessThanOrEqual(20);
  });
});
