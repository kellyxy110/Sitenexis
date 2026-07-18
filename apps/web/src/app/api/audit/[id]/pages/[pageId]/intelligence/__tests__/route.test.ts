import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

const h = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  rateLimit: vi.fn(),
  getAuditWithResults: vi.fn(),
  getPageById: vi.fn(),
  getIssuesByPage: vi.fn(),
  getRetrievalSimulations: vi.fn(),
  createOptimizationSession: vi.fn(),
  getGroqAndHermesProviders: vi.fn(),
  completeWithFallback: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  requireAuth: h.requireAuth,
  unauthorizedResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
}));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/ai/provider-chain', () => ({
  getGroqAndHermesProviders: h.getGroqAndHermesProviders,
  completeWithFallback: h.completeWithFallback,
}));
vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getPageById: h.getPageById,
  getIssuesByPage: h.getIssuesByPage,
  getRetrievalSimulations: h.getRetrievalSimulations,
  createOptimizationSession: h.createOptimizationSession,
}));
// buildFindingPool / filterTraceableRecommendations already have a dedicated, passing
// unit suite in packages/analyzers (including the hallucination-rejection cases) — mocked
// here with faithful lightweight equivalents so this suite stays fast and focused on
// route-level behavior (auth, ownership, status codes, persistence), and to avoid a slow
// first-time cold import of the full analyzers package under vitest.
vi.mock('@sitenexis/analyzers', () => ({
  buildFindingPool: (p: { issues: Array<{ id: string }> }) => p.issues.map((i) => ({ id: `issue:${i.id}`, label: i.id })),
  filterTraceableRecommendations: (
    recs: Array<{ sourceFindingIds: string[] }>,
    pool: Array<{ id: string }>,
  ) => {
    const valid = new Set(pool.map((f) => f.id));
    return recs.filter((r) => r.sourceFindingIds.length > 0 && r.sourceFindingIds.every((id) => valid.has(id)));
  },
  PAGE_INTELLIGENCE_SYSTEM_PROMPT: 'system prompt',
  buildPageIntelligenceUserPrompt: () => 'user prompt',
}));

const { POST } = await import('../route');

function req(): NextRequest {
  return {} as unknown as NextRequest;
}
const params = { params: Promise.resolve({ id: 'audit-1', pageId: 'page-1' }) };

const audit = { userId: 'user-1', status: 'complete' };
const page = {
  id: 'page-1', auditId: 'audit-1', url: 'https://example.com/blog/post',
  title: 'Old Title', metaDescription: null, h1: 'Old H1', wordCount: 300,
  seoScore: 55, aiScore: 60, bodyText: 'This is the original page content.',
};
const issues = [{ id: 'iss-1', module: 'seo', type: 'missing_meta_description', severity: 'warning', message: 'No meta description' }];

const validLlmOutput = {
  content: JSON.stringify({
    diagnosis: 'This page lacks a meta description and has thin content.',
    recommendations: [
      { action: 'Add a meta description', rationale: 'Improves CTR', sourceFindingIds: ['issue:iss-1'], expectedImpact: 'Higher click-through' },
      { action: 'Fabricated advice', rationale: 'x', sourceFindingIds: ['issue:does-not-exist'], expectedImpact: 'y' },
    ],
    optimizedTitle: 'New Title',
    optimizedMetaDescription: 'A helpful meta description under 155 characters.',
    optimizedH1: 'New H1',
    optimizedBodyText: 'This is the rewritten page content.',
    citabilityByEngine: [{ engine: 'ChatGPT', likelihood: 'medium', reasoning: 'Thin content limits citation.' }],
  }),
  model: 'llama-3.3-70b-versatile',
  provider: 'groq',
  latencyMs: 100,
};

beforeEach(() => {
  vi.clearAllMocks();
  h.requireAuth.mockResolvedValue({ id: 'user-1', email: 'a@b.com' });
  h.rateLimit.mockResolvedValue({ ok: true, headers: {} });
  h.getAuditWithResults.mockResolvedValue(audit);
  h.getPageById.mockResolvedValue(page);
  h.getIssuesByPage.mockResolvedValue(issues);
  h.getRetrievalSimulations.mockResolvedValue([]);
  h.getGroqAndHermesProviders.mockResolvedValue([{ adapter: { provider: 'groq' }, model: 'llama-3.3-70b-versatile' }]);
  h.completeWithFallback.mockResolvedValue(validLlmOutput);
  h.createOptimizationSession.mockImplementation(async (input: unknown) => ({ id: 'session-1', ...(input as object) }));
});

describe('POST /api/audit/[id]/pages/[pageId]/intelligence', () => {
  it('401 when unauthenticated', async () => {
    h.requireAuth.mockRejectedValueOnce(new Error('Unauthorized'));
    const res = await POST(req(), params);
    expect(res.status).toBe(401);
  });

  it('429 when rate limited', async () => {
    h.rateLimit.mockResolvedValueOnce({ ok: false, headers: {} });
    const res = await POST(req(), params);
    expect(res.status).toBe(429);
  });

  it('404 when the audit does not exist', async () => {
    h.getAuditWithResults.mockResolvedValueOnce(null);
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
  });

  it('403 when the audit belongs to another user', async () => {
    h.getAuditWithResults.mockResolvedValueOnce({ ...audit, userId: 'someone-else' });
    const res = await POST(req(), params);
    expect(res.status).toBe(403);
  });

  it('404 when the page does not belong to this audit', async () => {
    h.getPageById.mockResolvedValueOnce({ ...page, auditId: 'a-different-audit' });
    const res = await POST(req(), params);
    expect(res.status).toBe(404);
  });

  it('409 when the page has no extracted body text', async () => {
    h.getPageById.mockResolvedValueOnce({ ...page, bodyText: null });
    const res = await POST(req(), params);
    expect(res.status).toBe(409);
  });

  it('503 when no provider is configured', async () => {
    h.getGroqAndHermesProviders.mockResolvedValueOnce([]);
    const res = await POST(req(), params);
    expect(res.status).toBe(503);
  });

  it('200 on success — discards the recommendation citing a hallucinated finding id', async () => {
    const res = await POST(req(), params);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.discardedRecommendationCount).toBe(1);

    const saved = h.createOptimizationSession.mock.calls[0][0];
    expect(saved.recommendations).toHaveLength(1);
    expect(saved.recommendations[0].action).toBe('Add a meta description');
    expect(saved.diagnosis).toContain('meta description');
  });

  it('502 when every provider fails', async () => {
    h.completeWithFallback.mockRejectedValue(new Error('all providers down'));
    const res = await POST(req(), params);
    expect(res.status).toBe(502);
  });

  it('502 when the LLM returns malformed JSON', async () => {
    h.completeWithFallback.mockResolvedValue({ ...validLlmOutput, content: 'not json' });
    const res = await POST(req(), params);
    expect(res.status).toBe(502);
  });
});
