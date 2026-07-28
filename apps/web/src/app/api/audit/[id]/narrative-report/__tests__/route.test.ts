import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// importOriginal pulls in the real @sitenexis/analyzers barrel — under
// full-suite parallel load that alone can exceed the default 5s test timeout.
vi.setConfig({ testTimeout: 20_000 });

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getAuditWithResults: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getMachineTrustScore: vi.fn(),
  getTemporalAuthorityRecord: vi.fn(),
  getRetrievalSimulations: vi.fn(),
  getRecommendationSurfaceMap: vi.fn(),
  hybridAuditReportPrompt: vi.fn(),
  routeTask: vi.fn(),
  parseAIResponse: vi.fn(),
  callAI: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@sitenexis/crawler', () => ({
  createRedisClient: () => ({ get: async () => null, set: async () => {} }),
  getRedisUrl: () => null,
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getIssuesByAudit: h.getIssuesByAudit,
  getMachineTrustScore: h.getMachineTrustScore,
  getTemporalAuthorityRecord: h.getTemporalAuthorityRecord,
  getRetrievalSimulations: h.getRetrievalSimulations,
  getRecommendationSurfaceMap: h.getRecommendationSurfaceMap,
}));
vi.mock('@sitenexis/analyzers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    hybridAuditReportPrompt: h.hybridAuditReportPrompt,
    routeTask: h.routeTask,
    parseAIResponse: h.parseAIResponse,
    callAI: h.callAI,
  };
});

const { GET } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1' }) };

function issue(overrides: Record<string, unknown>): Record<string, unknown> {
  return {
    id: 'issue-1', auditId: 'audit-1', pageId: null, pageUrl: null,
    module: 'seo', type: 'title_too_long', severity: 'warning',
    message: 'Title is too long', recommendation: 'Shorten the title to under 70 characters.',
    problem: null, solution: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.getAuditWithResults.mockResolvedValue({
    userId: 'user-1', status: 'complete', domain: 'example.com', pageCount: 10,
    scores: { seoScore: 80, aiScore: 70, overall: 75 },
    aiVisibilityScores: { aiVisibilityScore: 70, entityConfidenceScore: 60, citationProbabilityScore: 65, machineReadabilityScore: 75, semanticTrustScore: 68 },
    entities: [],
  });
  h.getMachineTrustScore.mockResolvedValue(null);
  h.getTemporalAuthorityRecord.mockResolvedValue(null);
  h.getRetrievalSimulations.mockResolvedValue([]);
  h.getRecommendationSurfaceMap.mockResolvedValue(null);
  h.hybridAuditReportPrompt.mockReturnValue('PROMPT');
  h.routeTask.mockResolvedValue({ headline: 'ok' });
});

describe('GET /api/audit/[id]/narrative-report — issue dedup wiring', () => {
  it('feeds the AI prompt a deduplicated, page-annotated topIssues list, not raw per-page rows', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      issue({ id: 'i2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
      issue({ id: 'i3', pageUrl: 'https://x.com/c', message: 'Title is 79 chars (max 70)' }),
    ]);

    const res = await GET(req(), params);
    expect(res.status).toBe(200);

    expect(h.hybridAuditReportPrompt).toHaveBeenCalledTimes(1);
    const context = h.hybridAuditReportPrompt.mock.calls[0][0] as { topIssues: Array<{ message: string }> };
    expect(context.topIssues).toHaveLength(1);
    expect(context.topIssues[0]!.message).toContain('affects 3 pages');
  });

  it('keeps two genuinely different issue types as two separate topIssues entries', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', type: 'missing_h1', message: 'No <h1> tag found', pageUrl: 'https://x.com/a' }),
      issue({ id: 'i2', type: 'missing_title', message: 'No <title> tag found', recommendation: 'Add a descriptive title tag.', pageUrl: 'https://x.com/b' }),
    ]);

    await GET(req(), params);

    const context = h.hybridAuditReportPrompt.mock.calls[0][0] as { topIssues: unknown[] };
    expect(context.topIssues).toHaveLength(2);
  });
});
