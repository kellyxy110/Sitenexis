import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getDailyTrafficMetrics: vi.fn(),
  getAcquisitionChannelMetrics: vi.fn(),
  getAiReferralMetrics: vi.fn(),
  getSearchVisibilityMetrics: vi.fn(),
  getTopSearchQueries: vi.fn(),
  getTopSearchPages: vi.fn(),
  getAggregatedSearchPageMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getDailyTrafficMetrics: h.getDailyTrafficMetrics,
  getAcquisitionChannelMetrics: h.getAcquisitionChannelMetrics,
  getAiReferralMetrics: h.getAiReferralMetrics,
  getSearchVisibilityMetrics: h.getSearchVisibilityMetrics,
  getTopSearchQueries: h.getTopSearchQueries,
  getTopSearchPages: h.getTopSearchPages,
  getAggregatedSearchPageMetrics: h.getAggregatedSearchPageMetrics,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getDailyTrafficMetrics.mockResolvedValue([]);
  h.getAcquisitionChannelMetrics.mockResolvedValue([]);
  h.getAiReferralMetrics.mockResolvedValue([]);
  h.getSearchVisibilityMetrics.mockResolvedValue([]);
  h.getTopSearchQueries.mockResolvedValue([]);
  h.getTopSearchPages.mockResolvedValue([]);
  h.getAggregatedSearchPageMetrics.mockResolvedValue([]);
});

describe('GET /api/intelligence-center/dashboard', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('not_connected when there is no connection row at all', async () => {
    h.getGoogleConnection.mockResolvedValue(null);
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('not_connected');
  });

  it('pending when connected but no properties selected yet', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'pending', googleAccountEmail: 'a@gmail.com', ga4PropertyId: null, gscSiteUrl: null });
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('pending');
  });

  it('permission_expired when the connection token expired', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'expired', googleAccountEmail: 'a@gmail.com' });
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('permission_expired');
  });

  it('sync_failed when the connection is in an error state', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'error', googleAccountEmail: 'a@gmail.com', lastError: 'token invalid' });
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('sync_failed');
    expect(json.connector.lastError).toBe('token invalid');
  });

  it('sync_pending when connected with properties but never synced', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://x.com/', lastSyncedAt: null });
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('sync_pending');
  });

  it('no_data when connected and synced, but genuinely no rows', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://x.com/', lastSyncedAt: new Date() });
    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('no_data');
  });

  it('returns full aggregated data plus visibility gains/losses when data exists', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://x.com/', lastSyncedAt: new Date(), googleAccountEmail: 'a@gmail.com', ga4PropertyName: 'My Site', gscSiteName: 'https://x.com/' });
    h.getDailyTrafficMetrics.mockResolvedValue([{ date: new Date(), sessions: 100, activeUsers: 80 }]);
    h.getSearchVisibilityMetrics.mockResolvedValue([{ date: new Date(), clicks: 10, impressions: 200, ctr: 0.05, avgPosition: 5 }]);
    h.getAggregatedSearchPageMetrics
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 5, impressions: 150 }]) // current week
      .mockResolvedValueOnce([{ page: '/blog/a', clicks: 5, impressions: 100 }]); // previous week

    const res = await GET(req());
    const json = await res.json();
    expect(json.connector.status).toBe('connected');
    expect(json.traffic.totalSessions).toBe(100);
    expect(json.search.totalClicks).toBe(10);
    expect(json.visibilityGains).toHaveLength(1);
    expect(json.visibilityGains[0]).toMatchObject({ page: '/blog/a', deltaImpressions: 50 });
    expect(json.visibilityLosses).toHaveLength(0);
  });
});
