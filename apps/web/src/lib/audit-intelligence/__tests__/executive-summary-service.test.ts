import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getAuditById: vi.fn(),
  getAuditIntelligenceReport: vi.fn(),
  getRedisUrl: vi.fn(),
  redisGet: vi.fn(),
  routeTask: vi.fn(),
  callAI: vi.fn(),
  executiveSummaryPrompt: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById, getAuditIntelligenceReport: h.getAuditIntelligenceReport }));
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
  h.getAuditIntelligenceReport.mockResolvedValue(null);
});

describe('getExecutiveSummary — read-only / cost-isolation boundary', () => {
  it('returns null when the audit does not exist, without touching Redis, the DB report table, or any AI module', async () => {
    h.getAuditById.mockResolvedValue(null);

    const result = await getExecutiveSummary('missing-audit');

    expect(result).toBeNull();
    expect(h.getAuditIntelligenceReport).not.toHaveBeenCalled();
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
  });

  it('prefers the persisted canonical report over Redis when both exist', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    const persisted = { auditId: 'a1', modelVersion: 'v1.0', domain: 'truvyx.org', composite_score: 8.7, composite_label: 'Strong', overall_verdict: 'From DB.', sections: [], top_recommendations: [], audit_date: '2026-08-01', benchmark_statement: '', trajectory: '' };
    h.getAuditIntelligenceReport.mockResolvedValue({ executiveSummary: persisted });
    h.redisGet.mockResolvedValue(JSON.stringify({ ...persisted, overall_verdict: 'From Redis — should never be used.' }));

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toEqual(persisted);
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
  });

  it('falls back to the legacy Redis cache when no persisted row exists', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getAuditIntelligenceReport.mockResolvedValue(null);
    const cached = { auditId: 'a1', modelVersion: 'v1.0', domain: 'truvyx.org', composite_score: 8.7, composite_label: 'Strong', overall_verdict: 'Strong.', sections: [], top_recommendations: [], audit_date: '2026-08-01', benchmark_statement: '', trajectory: '' };
    h.redisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toEqual(cached);
    expect(h.redisGet).toHaveBeenCalledWith('exec-summary:a1:v1.0');
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.executiveSummaryPrompt).not.toHaveBeenCalled();
  });

  it('when neither the persisted row nor Redis has it, returns data: null and NEVER calls routeTask or callAI — the non-negotiable guarantee', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getAuditIntelligenceReport.mockResolvedValue(null);
    h.redisGet.mockResolvedValue(null);

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toBeNull();
    expect(result?.state).toBe('complete');
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.executiveSummaryPrompt).not.toHaveBeenCalled();
  });

  it('treats a DB lookup failure as "not persisted" and still falls back to Redis rather than throwing', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getAuditIntelligenceReport.mockRejectedValue(new Error('db unreachable'));
    const cached = { auditId: 'a1', modelVersion: 'v1.0', domain: 'truvyx.org', composite_score: 8.7, composite_label: 'Strong', overall_verdict: 'Strong.', sections: [], top_recommendations: [], audit_date: '2026-08-01', benchmark_statement: '', trajectory: '' };
    h.redisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getExecutiveSummary('a1');

    expect(result?.data).toEqual(cached);
  });

  it('on total cache miss with Redis entirely unavailable, still returns data: null without ever attempting generation', async () => {
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
