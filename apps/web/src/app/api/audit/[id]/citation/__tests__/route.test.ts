import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// getAuditWithResults is deliberately NOT mocked — if the route still called
// it, the destructured import would be undefined and the call would throw,
// failing every test below. Passing tests prove the heavy query is unused.
const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditById: vi.fn(),
  getAIVisibilityScore: vi.fn(),
  getAuditScores: vi.fn(),
  getCitationIntelligence: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/db', () => ({
  getAuditById: h.getAuditById,
  getAIVisibilityScore: h.getAIVisibilityScore,
  getAuditScores: h.getAuditScores,
  getCitationIntelligence: h.getCitationIntelligence,
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
  h.getAIVisibilityScore.mockResolvedValue(null);
  h.getAuditScores.mockResolvedValue(null);
  h.getCitationIntelligence.mockResolvedValue(null);
});

describe('GET /api/audit/[id]/citation', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
    expect(h.getAuditById).not.toHaveBeenCalled();
  });

  it('empty state when the audit belongs to another user (ownership pre-filtered at the query level, matching prior getAuditWithResults(id, userId) behavior)', async () => {
    h.getAuditById.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.state).toBe('empty');
  });

  it('empty state when the audit does not exist', async () => {
    h.getAuditById.mockResolvedValueOnce(null);
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.state).toBe('empty');
  });

  it('owner succeeds and reads persisted AI visibility/citation data without recomputation', async () => {
    h.getAIVisibilityScore.mockResolvedValueOnce({ citationProbabilityScore: 74 });
    h.getAuditScores.mockResolvedValueOnce({
      breakdown: { citationAnalysis: { topCandidates: ['a'], blockers: ['b'], recommendations: ['c'], pageBreakdown: [{ url: 'x' }] } },
    });
    h.getCitationIntelligence.mockResolvedValueOnce({ status: 'completed' });

    const res = await GET(req(), params);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data).toMatchObject({
      auditId: 'audit-1',
      citationProbabilityScore: 74,
      topCitationCandidates: ['a'],
      citationBlockers: ['b'],
      recommendations: ['c'],
      pageBreakdown: [{ url: 'x' }],
      citationIntelligence: { status: 'completed' },
    });
    expect(h.getAuditById).toHaveBeenCalledWith('audit-1', 'user-1');
    expect(h.getAuditById).toHaveBeenCalledTimes(1);
  });

  it('returns null data when no AI visibility score has been computed yet', async () => {
    const res = await GET(req(), params);
    const json = await res.json();
    expect(json.data).toBeNull();
  });
});
