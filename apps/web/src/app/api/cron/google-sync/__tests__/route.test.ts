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
});
