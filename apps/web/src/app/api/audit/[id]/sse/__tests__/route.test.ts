import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getSseScore: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditById: h.getAuditById,
  getSseScore: h.getSseScore,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditById.mockResolvedValue({ id: 'audit-1', userId: 'user-1', domain: 'example.com', status: 'complete' });
  h.getSseScore.mockResolvedValue(null);
});

describe('GET /api/audit/[id]/sse (persisted SSE/topical-authority scores — not Server-Sent Events)', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditById.mockResolvedValueOnce({ id: 'audit-1', userId: 'someone-else', domain: 'example.com', status: 'complete' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });

  it('empty state when the audit does not exist', async () => {
    h.getAuditById.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
  });

  it('owner succeeds and reads the persisted score row', async () => {
    h.getSseScore.mockResolvedValueOnce({
      topicalAuthorityScore: 70, taDepth: 1, taBreadth: 1, taInterlinking: 1, taFreshness: 1,
      semanticDensityScore: 60, sdsRawDensity: 1, sdsEntityCount: 1, sdsFactCount: 1, sdsRelationshipCount: 1, sdsTotalWords: 1,
      aiCrawlabilityScore: 80, aciRobots: 1, aciSitemap: 1, aciRenderability: 1, aciIndexability: 1,
      geoScore: 50, snsMasterScore: 65, snsLabel: 'Good',
    });
    const res = await GET(req(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({ auditId: 'audit-1', topicalAuthorityScore: 70, snsMasterScore: 65 });
    expect(h.getAuditById).toHaveBeenCalledTimes(1);
  });
});
