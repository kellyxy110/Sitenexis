import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getDailyTrafficMetrics: vi.fn(),
  getSearchVisibilityMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getDailyTrafficMetrics: h.getDailyTrafficMetrics,
  getSearchVisibilityMetrics: h.getSearchVisibilityMetrics,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/trends', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await GET(req('https://x.com/api?granularity=daily'));
    expect(res.status).toBe(401);
  });

  it('400 on an invalid granularity', async () => {
    const res = await GET(req('https://x.com/api?granularity=yearly'));
    expect(res.status).toBe(400);
  });

  it('reports not_connected when there is no Google connection', async () => {
    h.getGoogleConnection.mockResolvedValue(null);
    const res = await GET(req('https://x.com/api?granularity=daily'));
    const json = await res.json();
    expect(json.connector.status).toBe('not_connected');
  });

  it('short-circuits on a non-connected status without querying metrics', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'pending' });
    const res = await GET(req('https://x.com/api?granularity=daily'));
    const json = await res.json();
    expect(json.connector.status).toBe('pending');
    expect(h.getDailyTrafficMetrics).not.toHaveBeenCalled();
  });

  it('buckets real rows for the requested granularity', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1', gscSiteUrl: 'sc-domain:x.com' });
    h.getDailyTrafficMetrics.mockResolvedValue([
      { date: new Date('2026-01-01'), sessions: 10, activeUsers: 5 },
      { date: new Date('2026-01-02'), sessions: 20, activeUsers: 8 },
    ]);
    h.getSearchVisibilityMetrics.mockResolvedValue([]);

    const res = await GET(req('https://x.com/api?granularity=daily'));
    const json = await res.json();

    expect(json.traffic).toHaveLength(2);
    expect(json.granularity).toBe('daily');
  });

  it('defaults to daily granularity when none is supplied', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: null, gscSiteUrl: null });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.granularity).toBe('daily');
  });
});
