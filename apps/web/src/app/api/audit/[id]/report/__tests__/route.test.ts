import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditWithResults: vi.fn(),
  getAuditScores: vi.fn(),
  getAIVisibilityScore: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getSseScore: vi.fn(),
  getMachineTrustScore: vi.fn(),
  getTemporalAuthorityRecord: vi.fn(),
  getRetrievalSimulations: vi.fn(),
  getRecommendationSurfaceMap: vi.fn(),
  getEntitiesByAudit: vi.fn(),
  getLatestSyntheticEntityAnalysis: vi.fn(),
  buildMachineResourceStudioReport: vi.fn(),
  signReport: vi.fn(),
  getRedisUrl: vi.fn(),
  createRedisClient: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getAuditScores: h.getAuditScores,
  getAIVisibilityScore: h.getAIVisibilityScore,
  getIssuesByAudit: h.getIssuesByAudit,
  getSseScore: h.getSseScore,
  getMachineTrustScore: h.getMachineTrustScore,
  getTemporalAuthorityRecord: h.getTemporalAuthorityRecord,
  getRetrievalSimulations: h.getRetrievalSimulations,
  getRecommendationSurfaceMap: h.getRecommendationSurfaceMap,
  getEntitiesByAudit: h.getEntitiesByAudit,
  getLatestSyntheticEntityAnalysis: h.getLatestSyntheticEntityAnalysis,
}));
vi.mock('@sitenexis/analyzers', () => ({
  buildMachineResourceStudioReport: h.buildMachineResourceStudioReport,
  signReport: h.signReport,
}));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: h.createRedisClient,
}));

const { POST } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

const baseAudit = {
  id: 'audit-1',
  userId: 'user-1',
  domain: 'example.com',
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
  completedAt: new Date('2026-01-01T00:10:00.000Z'),
  pageCount: 5,
  pages: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditWithResults.mockResolvedValue(baseAudit);
  h.getAuditScores.mockResolvedValue({
    overall: 80, seoScore: 80, aiScore: 75, schemaScore: 70, linkGraphScore: 65, performanceScore: 90,
    breakdown: {},
  });
  h.getAIVisibilityScore.mockResolvedValue(null);
  h.getIssuesByAudit.mockResolvedValue([]);
  h.getSseScore.mockResolvedValue(null);
  h.getMachineTrustScore.mockResolvedValue(null);
  h.getTemporalAuthorityRecord.mockResolvedValue(null);
  h.getRetrievalSimulations.mockResolvedValue([]);
  h.getRecommendationSurfaceMap.mockResolvedValue(null);
  h.getEntitiesByAudit.mockResolvedValue([]);
  h.getLatestSyntheticEntityAnalysis.mockResolvedValue(null);
  h.getRedisUrl.mockReturnValue(null);
  h.buildMachineResourceStudioReport.mockReturnValue({
    scoreCards: [], strengths: [], weaknesses: [], recommendations: [], limitations: [],
    executiveSummary: '', technicalExplanation: '', aiExplanation: '',
  });
  h.signReport.mockReturnValue({ reportId: 'r1', inputHash: 'hash1', engineVersion: 'v1', signedAt: '2026-01-01T00:00:00.000Z' });
});

describe('POST /api/audit/[id]/report — MRSInput compatibility', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('no'));
    const res = await POST(req(), params);
    expect(res.status).toBe(401);
  });

  it('200 and passes the canonical Machine Trust score into the shared MRS engine', async () => {
    h.getMachineTrustScore.mockResolvedValue({ overall: 39 });

    const res = await POST(req(), params);

    expect(res.status).toBe(200);
    expect(h.buildMachineResourceStudioReport).toHaveBeenCalledWith(
      expect.objectContaining({ machineTrust: { overall: 39 } })
    );
  });

  it('reports machineTrust as null when no machine_trust_scores row exists for this audit', async () => {
    const res = await POST(req(), params);

    expect(res.status).toBe(200);
    expect(h.buildMachineResourceStudioReport).toHaveBeenCalledWith(
      expect.objectContaining({ machineTrust: null })
    );
  });
});
