import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditWithResults: vi.fn(),
  getMachineTrustScore: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getMachineTrustScore: h.getMachineTrustScore,
}));

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

const baseAudit = {
  id: 'audit-1',
  userId: 'user-1',
  domain: 'example.com',
  status: 'complete' as const,
  completedAt: new Date('2026-08-01T00:00:00.000Z'),
  pageCount: 10,
  scores: { overall: 60, seoScore: 60, aiScore: 60, schemaScore: 60, linkGraphScore: 60, performanceScore: 60 },
  aiVisibilityScores: {
    aiVisibilityScore: 78,
    machineReadabilityScore: 80,
    entityConfidenceScore: 75,
    retrievalReadinessScore: 88,
    citationProbabilityScore: 92,
    semanticTrustScore: 92,
    recommendationConfidence: 70,
  },
  pages: [],
  issues: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditWithResults.mockResolvedValue(baseAudit);
  h.getMachineTrustScore.mockResolvedValue({ overall: 39 });
});

describe('GET /api/audit/[id]/machine-resources — Machine Trust score consistency', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await GET(req(), params);
    expect(res.status).toBe(401);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditWithResults.mockResolvedValue({ ...baseAudit, userId: 'someone-else' });
    const res = await GET(req(), params);
    expect(res.status).toBe(403);
  });

  it('reads the "trust" score card from the canonical machine_trust_scores value, not AIVisibilityScore.semanticTrustScore', async () => {
    const res = await GET(req(), params);
    const body = await res.json();

    const trustCard = body.data.scoreCards.find((card: { key: string }) => card.key === 'trust');
    expect(trustCard.value).toBe(39);
    expect(trustCard.value).not.toBe(92);
  });

  it('reports the trust card as null and adds a limitation when no machine_trust_scores row exists yet', async () => {
    h.getMachineTrustScore.mockResolvedValue(null);

    const res = await GET(req(), params);
    const body = await res.json();

    const trustCard = body.data.scoreCards.find((card: { key: string }) => card.key === 'trust');
    expect(trustCard.value).toBeNull();
    expect(body.data.limitations).toContain('Machine Trust score is unavailable for this audit (Layer 4 analysis required).');
  });
});
