import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  getAggregatedBreakdowns: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  getAggregatedBreakdowns: h.getAggregatedBreakdowns,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
});

describe('GET /api/intelligence-center/breakdowns', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    expect((await GET(req())).status).toBe(401);
  });

  it('reports not_connected with no query when there is no connection', async () => {
    h.getGoogleConnection.mockResolvedValue(null);
    const json = await (await GET(req())).json();
    expect(json.connector.status).toBe('not_connected');
    expect(h.getAggregatedBreakdowns).not.toHaveBeenCalled();
  });

  it('short-circuits on a non-connected status', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'sync_failed' });
    const json = await (await GET(req())).json();
    expect(json.connector.status).toBe('sync_failed');
    expect(h.getAggregatedBreakdowns).not.toHaveBeenCalled();
  });

  it('returns real aggregated breakdowns when connected', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected' });
    h.getAggregatedBreakdowns.mockResolvedValue({
      traffic: { device: { mobile: 10 }, country: { US: 10 } },
      search: { device: { desktop: 5 }, country: { UK: 5 } },
    });

    const json = await (await GET(req())).json();

    expect(json.traffic.device).toEqual({ mobile: 10 });
    expect(json.search.country).toEqual({ UK: 5 });
  });
});
