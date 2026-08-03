import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getAggregatedAcquisitionMetrics: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getAggregatedAcquisitionMetrics: h.getAggregatedAcquisitionMetrics,
}));

const { GET } = await import('../route');

function req(url: string): NextRequest {
  return { nextUrl: new URL(url) } as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/acquisition', () => {
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

  it('returns an empty channel list when no GA4 property is configured', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: null });
    const res = await GET(req('https://x.com/api'));
    const json = await res.json();
    expect(json.channels).toEqual([]);
  });

  it('preserves the isAiReferral flag per channel/source and computes real share-of-sessions', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    h.getAggregatedAcquisitionMetrics.mockResolvedValue([
      { channelGroup: 'Organic Search', source: 'google', isAiReferral: false, sessions: 300, activeUsers: 200 },
      { channelGroup: 'Referral', source: 'chatgpt.com', isAiReferral: true, sessions: 100, activeUsers: 80 },
    ]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.totalSessions).toBe(400);
    const ai = json.channels.find((c: { source: string }) => c.source === 'chatgpt.com');
    expect(ai.isAiReferral).toBe(true);
    expect(ai.shareOfSessions).toBeCloseTo(0.25);
  });

  it('reports shareOfSessions as 0 (not NaN) when there is no traffic at all', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    h.getAggregatedAcquisitionMetrics.mockResolvedValue([{ channelGroup: 'Direct', source: '(direct)', isAiReferral: false, sessions: 0, activeUsers: 0 }]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.channels[0].shareOfSessions).toBe(0);
  });

  it('sorts channels by sessions descending', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', ga4PropertyId: 'p1' });
    h.getAggregatedAcquisitionMetrics.mockResolvedValue([
      { channelGroup: 'Direct', source: '(direct)', isAiReferral: false, sessions: 10, activeUsers: 10 },
      { channelGroup: 'Organic Search', source: 'google', isAiReferral: false, sessions: 300, activeUsers: 200 },
    ]);

    const res = await GET(req('https://x.com/api'));
    const json = await res.json();

    expect(json.channels[0].source).toBe('google');
  });
});
