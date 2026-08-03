import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getAuditById: vi.fn(),
  getRedisUrl: vi.fn(),
  redisGet: vi.fn(),
  routeTask: vi.fn(),
  callAI: vi.fn(),
  executiveSummaryPrompt: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById }));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: () => ({ get: h.redisGet }),
}));
// If the service ever imports these, the mock makes the call observable —
// this is the trip-wire the "never invokes an LLM" tests below rely on.
vi.mock('@sitenexis/analyzers', () => ({
  routeTask: h.routeTask,
  callAI: h.callAI,
  executiveSummaryPrompt: h.executiveSummaryPrompt,
}));

const { getExecutiveSummary } = await import('../executive-summary-service');

beforeEach(() => {
  vi.clearAllMocks();
  h.getRedisUrl.mockReturnValue('redis://localhost:6379');
});

describe('getExecutiveSummary — read-only / cost-isolation boundary', () => {
  it('returns null when the audit does not exist, without touching Redis or any AI module', async () => {
    h.getAuditById.mockResolvedValue(null);

    const result = await getExecutiveSummary('missing-audit');

    expect(result).toBeNull();
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
  });

  it('returns the cached prose on a cache hit, verbatim, with no AI call', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    const cached = { auditId: 'a1', modelVersion: 'v1.0', domain: 'truvyx.org', composite_score: 8.7, composite_label: 'Strong', overall_verdict: 'Strong.', sections: [], top_recommendations: [], audit_date: '2026-08-01', benchmark_statement: '', trajectory: '' };
    h.redisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toEqual(cached);
    expect(h.redisGet).toHaveBeenCalledWith('exec-summary:a1:v1.0');
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.executiveSummaryPrompt).not.toHaveBeenCalled();
  });

  it('on a cache miss, returns data: null and NEVER calls routeTask or callAI — this is the non-negotiable guarantee', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.redisGet.mockResolvedValue(null);

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toBeNull();
    expect(result?.state).toBe('complete');
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.executiveSummaryPrompt).not.toHaveBeenCalled();
  });

  it('on a cache miss with Redis entirely unavailable, still returns data: null without ever attempting generation', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getRedisUrl.mockReturnValue(undefined);

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toBeNull();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
  });

  it('reflects a partial audit status in the returned GTL state', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'partial' });
    h.redisGet.mockResolvedValue(null);

    const result = await getExecutiveSummary('a1');

    expect(result?.state).toBe('partial');
  });
});
