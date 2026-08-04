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
  getAiVisibilityInsights: vi.fn(),
  getLatestGoogleSyncLogForProvider: vi.fn(),
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
  getAiVisibilityInsights: h.getAiVisibilityInsights,
  getLatestGoogleSyncLogForProvider: h.getLatestGoogleSyncLogForProvider,
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
  h.getAiVisibilityInsights.mockResolvedValue([]);
  h.getLatestGoogleSyncLogForProvider.mockResolvedValue(null);
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

  it('includes deterministic AI visibility insights in the response', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://x.com/', lastSyncedAt: new Date(), googleAccountEmail: 'a@gmail.com' });
    h.getDailyTrafficMetrics.mockResolvedValue([{ date: new Date(), sessions: 100, activeUsers: 80 }]);
    h.getAiVisibilityInsights.mockResolvedValue([
      {
        id: 'insight-1', type: 'high_impressions_low_ctr', affectedPage: '/blog/a',
        evidence: { impressions: 1000, clicks: 5, ctr: 0.005 }, confidence: 0.6,
        recommendedAction: 'Rewrite the title tag.', verificationMethod: 'Check CTR next week.',
        severity: 'info', createdAt: new Date(),
      },
    ]);

    const res = await GET(req());
    const json = await res.json();
    expect(json.insights).toHaveLength(1);
    expect(json.insights[0]).toMatchObject({ id: 'insight-1', type: 'high_impressions_low_ctr', affectedPage: '/blog/a' });
  });

  // "Unavailable ≠ Zero": GSC can have real data while GA4 has never
  // successfully synced (e.g. the YYYYMMDD date-format defect). In that
  // state daily=[] purely because GA4 never ran — not because Google
  // measured zero traffic — so ga4Available must say so explicitly.
  describe('ga4Available — unavailable vs. legitimate zero', () => {
    const connectedBase = {
      status: 'connected', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://x.com/',
      lastSyncedAt: new Date(), googleAccountEmail: 'a@gmail.com',
    };

    it('is false when GA4 has never been attempted (no sync log at all)', async () => {
      h.getGoogleConnection.mockResolvedValue(connectedBase);
      h.getSearchVisibilityMetrics.mockResolvedValue([{ date: new Date(), clicks: 0, impressions: 22, ctr: 0, avgPosition: 15.3 }]);
      h.getLatestGoogleSyncLogForProvider.mockResolvedValue(null);

      const res = await GET(req());
      const json = await res.json();
      expect(json.ga4Available).toBe(false);
      expect(json.traffic.totalVisitors).toBe(0);
      expect(json.search.totalImpressions).toBe(22);
    });

    it('is false when GA4\'s most recent sync attempt failed', async () => {
      h.getGoogleConnection.mockResolvedValue(connectedBase);
      h.getSearchVisibilityMetrics.mockResolvedValue([{ date: new Date(), clicks: 0, impressions: 22, ctr: 0, avgPosition: 15.3 }]);
      h.getLatestGoogleSyncLogForProvider.mockResolvedValue({ provider: 'ga4', status: 'failed', errorMessage: 'Invalid startDate' });

      const res = await GET(req());
      const json = await res.json();
      expect(json.ga4Available).toBe(false);
    });

    it('is true when GA4\'s most recent sync attempt succeeded, even if it returned zero rows', async () => {
      h.getGoogleConnection.mockResolvedValue(connectedBase);
      h.getDailyTrafficMetrics.mockResolvedValue([]); // Google genuinely returned nothing
      h.getLatestGoogleSyncLogForProvider.mockResolvedValue({ provider: 'ga4', status: 'success', recordsSynced: 0 });
      h.getSearchVisibilityMetrics.mockResolvedValue([{ date: new Date(), clicks: 0, impressions: 22, ctr: 0, avgPosition: 15.3 }]);

      const res = await GET(req());
      const json = await res.json();
      expect(json.ga4Available).toBe(true);
      expect(json.traffic.totalVisitors).toBe(0); // a legitimate, trustworthy zero
    });

    it('is true and reflects real numbers when GA4 has real synced data', async () => {
      h.getGoogleConnection.mockResolvedValue(connectedBase);
      h.getDailyTrafficMetrics.mockResolvedValue([{ date: new Date(), sessions: 100, activeUsers: 80 }]);
      h.getLatestGoogleSyncLogForProvider.mockResolvedValue({ provider: 'ga4', status: 'success', recordsSynced: 12 });

      const res = await GET(req());
      const json = await res.json();
      expect(json.ga4Available).toBe(true);
      expect(json.traffic.totalVisitors).toBe(80);
    });

    it('never queries the GA4 sync log when the connection has no ga4PropertyId', async () => {
      h.getGoogleConnection.mockResolvedValue({ ...connectedBase, ga4PropertyId: null });
      h.getSearchVisibilityMetrics.mockResolvedValue([{ date: new Date(), clicks: 0, impressions: 22, ctr: 0, avgPosition: 15.3 }]);

      const res = await GET(req());
      const json = await res.json();
      expect(h.getLatestGoogleSyncLogForProvider).not.toHaveBeenCalled();
      expect(json.ga4Available).toBe(false);
    });
  });
});
