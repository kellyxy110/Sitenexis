import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  getAllSyncableGoogleConnections: vi.fn(),
  logGoogleSync: vi.fn(),
  touchGoogleConnectionSynced: vi.fn(),
  setGoogleConnectionError: vi.fn(),
  upsertDailyTrafficMetrics: vi.fn(),
  upsertAcquisitionChannelMetrics: vi.fn(),
  upsertLandingPageMetrics: vi.fn(),
  upsertSearchVisibilityMetrics: vi.fn(),
  upsertSearchQueryMetrics: vi.fn(),
  upsertSearchPageMetrics: vi.fn(),
  getValidAccessToken: vi.fn(),
  fetchGa4Metrics: vi.fn(),
  fetchGscMetrics: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({ env: { CRON_SECRET: 'test-cron-secret' } }));
vi.mock('@/lib/google/token-manager', () => ({
  getValidAccessToken: h.getValidAccessToken,
  GoogleTokenError: class GoogleTokenError extends Error {},
}));
vi.mock('@/lib/google/ga4-sync', () => ({ fetchGa4Metrics: h.fetchGa4Metrics }));
vi.mock('@/lib/google/gsc-sync', () => ({ fetchGscMetrics: h.fetchGscMetrics }));
vi.mock('@sitenexis/db', () => ({
  getAllSyncableGoogleConnections: h.getAllSyncableGoogleConnections,
  logGoogleSync: h.logGoogleSync,
  touchGoogleConnectionSynced: h.touchGoogleConnectionSynced,
  setGoogleConnectionError: h.setGoogleConnectionError,
  upsertDailyTrafficMetrics: h.upsertDailyTrafficMetrics,
  upsertAcquisitionChannelMetrics: h.upsertAcquisitionChannelMetrics,
  upsertLandingPageMetrics: h.upsertLandingPageMetrics,
  upsertSearchVisibilityMetrics: h.upsertSearchVisibilityMetrics,
  upsertSearchQueryMetrics: h.upsertSearchQueryMetrics,
  upsertSearchPageMetrics: h.upsertSearchPageMetrics,
}));

const { GET } = await import('../route');

function req(auth?: string): NextRequest {
  return { headers: new Headers(auth ? { authorization: auth } : {}) } as unknown as NextRequest;
}

const emptyGa4Result = { daily: [], channels: [], landingPages: [] };
const emptyGscResult = { daily: [], queries: [], pages: [] };

beforeEach(() => {
  vi.clearAllMocks();
  h.getValidAccessToken.mockResolvedValue('fake-access-token');
  h.fetchGa4Metrics.mockResolvedValue(emptyGa4Result);
  h.fetchGscMetrics.mockResolvedValue(emptyGscResult);
});

describe('GET /api/cron/google-sync', () => {
  it('401 without the correct bearer secret', async () => {
    const res = await GET(req('Bearer wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('401 with no authorization header at all', async () => {
    const res = await GET(req());
    expect(res.status).toBe(401);
  });

  it('syncs both GA4 and GSC for a fully-connected user', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://example.com/' },
    ]);
    const res = await GET(req('Bearer test-cron-secret'));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ totalConnections: 1, ga4Synced: 1, gscSynced: 1, failures: 0 });
    expect(h.touchGoogleConnectionSynced).toHaveBeenCalledWith('user-1');
  });

  it('a GA4 failure does not block that same user\'s Search Console sync', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://example.com/' },
    ]);
    h.fetchGa4Metrics.mockRejectedValue(new Error('GA4 API error'));
    const res = await GET(req('Bearer test-cron-secret'));
    const json = await res.json();
    expect(json).toMatchObject({ ga4Synced: 0, gscSynced: 1, failures: 1 });
    expect(h.fetchGscMetrics).toHaveBeenCalled();
  });

  it('one connection\'s token failure does not block the next connection\'s sync', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: null },
      { id: 'conn-2', userId: 'user-2', ga4PropertyId: 'prop-2', gscSiteUrl: null },
    ]);
    h.getValidAccessToken.mockRejectedValueOnce(new Error('token refresh failed')).mockResolvedValueOnce('fake-token');
    const res = await GET(req('Bearer test-cron-secret'));
    const json = await res.json();
    expect(json).toMatchObject({ totalConnections: 2, ga4Synced: 1, failures: 1 });
  });

  // Regression coverage for the YYYYMMDD-vs-YYYY-MM-DD defect: GA4's Data API
  // rejects dateRanges.startDate/endDate unless they are YYYY-MM-DD (or a
  // relative keyword). The cron route previously passed a compact YYYYMMDD
  // string (built for GA4's *response* date format, not its request format),
  // which Google rejected outright before any report ever ran.
  it('sends GA4 dateRanges as YYYY-MM-DD, never as compact YYYYMMDD', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: null },
    ]);
    await GET(req('Bearer test-cron-secret'));

    expect(h.fetchGa4Metrics).toHaveBeenCalledTimes(1);
    const [, , range] = h.fetchGa4Metrics.mock.calls[0]!;
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.startDate).not.toMatch(/^\d{8}$/);
    expect(range.endDate).not.toMatch(/^\d{8}$/);
  });

  it('sends GSC dateRanges as YYYY-MM-DD too, unaffected by the GA4 fix', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: null, gscSiteUrl: 'https://example.com/' },
    ]);
    await GET(req('Bearer test-cron-secret'));

    expect(h.fetchGscMetrics).toHaveBeenCalledTimes(1);
    const [, , range] = h.fetchGscMetrics.mock.calls[0]!;
    expect(range.startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.endDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('a Search Console failure does not block that same user\'s GA4 sync', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: 'https://example.com/' },
    ]);
    h.fetchGscMetrics.mockRejectedValue(new Error('GSC API error'));
    const res = await GET(req('Bearer test-cron-secret'));
    const json = await res.json();
    expect(json).toMatchObject({ ga4Synced: 1, gscSynced: 0, failures: 1 });
    expect(h.fetchGa4Metrics).toHaveBeenCalled();
  });

  it('persists a successful GA4 response into all three GA4 tables', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: null },
    ]);
    const daily = [{ date: new Date('2026-07-31'), sessions: 5, activeUsers: 4, newUsers: 1, engagedSessions: 3, avgEngagementTimeSec: 12, keyEvents: 0, pageViews: 9, bounceRate: 0.2, deviceBreakdown: {}, countryBreakdown: {} }];
    const channels = [{ date: new Date('2026-07-31'), channelGroup: 'Organic Search', source: 'google', sessions: 5, activeUsers: 4, isAiReferral: false }];
    const landingPages = [{ date: new Date('2026-07-31'), pagePath: '/', sessions: 5, activeUsers: 4, avgEngagementTimeSec: 12, keyEvents: 0 }];
    h.fetchGa4Metrics.mockResolvedValue({ daily, channels, landingPages });

    const res = await GET(req('Bearer test-cron-secret'));
    const json = await res.json();

    expect(json).toMatchObject({ ga4Synced: 1, failures: 0 });
    expect(h.upsertDailyTrafficMetrics).toHaveBeenCalledWith('user-1', daily);
    expect(h.upsertAcquisitionChannelMetrics).toHaveBeenCalledWith('user-1', channels);
    expect(h.upsertLandingPageMetrics).toHaveBeenCalledWith('user-1', landingPages);
    expect(h.logGoogleSync).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ga4', status: 'success', recordsSynced: 3 }));
  });

  it('never persists fabricated data for GA4 when the fetch fails — upserts are simply never called', async () => {
    h.getAllSyncableGoogleConnections.mockResolvedValue([
      { id: 'conn-1', userId: 'user-1', ga4PropertyId: 'prop-1', gscSiteUrl: null },
    ]);
    h.fetchGa4Metrics.mockRejectedValue(new Error('Invalid startDate : 20260731. startDate must be YYYY-MM-DD, NdaysAgo, yesterday, or today.'));

    const res = await GET(req('Bearer test-cron-secret'));
    const json = await res.json();

    expect(json).toMatchObject({ ga4Synced: 0, failures: 1 });
    expect(h.upsertDailyTrafficMetrics).not.toHaveBeenCalled();
    expect(h.upsertAcquisitionChannelMetrics).not.toHaveBeenCalled();
    expect(h.upsertLandingPageMetrics).not.toHaveBeenCalled();
    expect(h.logGoogleSync).toHaveBeenCalledWith(expect.objectContaining({ provider: 'ga4', status: 'failed' }));
  });
});
