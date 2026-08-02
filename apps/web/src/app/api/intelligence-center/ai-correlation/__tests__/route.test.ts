import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getGoogleConnection: vi.fn(),
  listAuditsByUser: vi.fn(),
  getDailyTrafficMetrics: vi.fn(),
  getSearchVisibilityMetrics: vi.fn(),
  matchAuditDomainToConnection: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getGoogleConnection: h.getGoogleConnection,
  listAuditsByUser: h.listAuditsByUser,
  getDailyTrafficMetrics: h.getDailyTrafficMetrics,
  getSearchVisibilityMetrics: h.getSearchVisibilityMetrics,
}));
vi.mock('@/lib/google/domain-match', () => ({
  matchAuditDomainToConnection: h.matchAuditDomainToConnection,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getDailyTrafficMetrics.mockResolvedValue([]);
  h.getSearchVisibilityMetrics.mockResolvedValue([]);
});

describe('GET /api/intelligence-center/ai-correlation', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    expect((await GET(req())).status).toBe(401);
  });

  it('reports not_connected when there is no Google connection', async () => {
    h.getGoogleConnection.mockResolvedValue(null);
    const json = await (await GET(req())).json();
    expect(json.connector.status).toBe('not_connected');
  });

  it('reports empty state when the user has no complete audits with AI Visibility scores', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected' });
    h.listAuditsByUser.mockResolvedValue({ data: [], total: 0 });

    const json = await (await GET(req())).json();

    expect(json.state).toBe('empty');
    expect(json.points).toEqual([]);
  });

  it('reports empty state (with a reason) when no audited domain matches the connected property', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com' });
    h.listAuditsByUser.mockResolvedValue({
      data: [{ id: 'a1', domain: 'other.com', status: 'complete', completedAt: new Date(), aiVisibilityScores: { aiVisibilityScore: 70 } }],
      total: 1,
    });
    h.matchAuditDomainToConnection.mockReturnValue({ domain: null, confidence: 'none' });

    const json = await (await GET(req())).json();

    expect(json.state).toBe('empty');
    expect(typeof json.reason).toBe('string');
  });

  it('returns real correlation points for the matched domain\'s complete audits', async () => {
    h.getGoogleConnection.mockResolvedValue({ status: 'connected', gscSiteUrl: 'sc-domain:x.com', ga4PropertyId: 'p1' });
    h.listAuditsByUser.mockResolvedValue({
      data: [
        { id: 'a1', domain: 'x.com', status: 'complete', completedAt: new Date('2026-01-01'), aiVisibilityScores: { aiVisibilityScore: 60 } },
        { id: 'a2', domain: 'x.com', status: 'running', completedAt: null, aiVisibilityScores: null },
      ],
      total: 2,
    });
    h.matchAuditDomainToConnection.mockReturnValue({ domain: 'x.com', confidence: 'exact' });
    h.getDailyTrafficMetrics.mockResolvedValue([{ date: new Date('2026-01-01'), sessions: 50 }]);

    const json = await (await GET(req())).json();

    expect(json.matchedDomain).toBe('x.com');
    expect(json.points).toHaveLength(1);
    expect(json.points[0].aiVisibilityScore).toBe(60);
  });
});
