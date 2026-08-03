import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getAuditById: vi.fn(),
  getRedisUrl: vi.fn(),
  redisGet: vi.fn(),
  routeTask: vi.fn(),
  callAI: vi.fn(),
  parseAIResponse: vi.fn(),
  hybridAuditReportPrompt: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById }));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: () => ({ get: h.redisGet }),
}));
vi.mock('@sitenexis/analyzers', () => ({
  routeTask: h.routeTask,
  callAI: h.callAI,
  parseAIResponse: h.parseAIResponse,
  hybridAuditReportPrompt: h.hybridAuditReportPrompt,
}));

const { getNarrativeReport } = await import('../narrative-report-service');

beforeEach(() => {
  vi.clearAllMocks();
  h.getRedisUrl.mockReturnValue('redis://localhost:6379');
});

describe('getNarrativeReport — read-only / cost-isolation boundary', () => {
  it('returns null when the audit does not exist, without touching Redis or any AI module', async () => {
    h.getAuditById.mockResolvedValue(null);

    const result = await getNarrativeReport('missing-audit');

    expect(result).toBeNull();
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
  });

  it('returns the cached report on a cache hit, with no AI call', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    const cached = { auditId: 'a1', domain: 'truvyx.org', generatedAt: '2026-08-01T00:00:00Z', modelVersion: 'v4.1', summary: 'ok' };
    h.redisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getNarrativeReport('a1');

    expect(result?.data).toEqual(cached);
    expect(h.redisGet).toHaveBeenCalledWith('narrative:a1:v4.1');
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.parseAIResponse).not.toHaveBeenCalled();
    expect(h.hybridAuditReportPrompt).not.toHaveBeenCalled();
  });

  it('on a cache miss, returns data: null and NEVER calls routeTask, callAI, or parseAIResponse — this is the non-negotiable guarantee', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.redisGet.mockResolvedValue(null);

    const result = await getNarrativeReport('a1');

    expect(result?.data).toBeNull();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.parseAIResponse).not.toHaveBeenCalled();
    expect(h.hybridAuditReportPrompt).not.toHaveBeenCalled();
  });

  it('on a cache miss with Redis entirely unavailable, still returns data: null without ever attempting generation', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getRedisUrl.mockReturnValue(undefined);

    const result = await getNarrativeReport('a1');

    expect(result?.data).toBeNull();
    expect(h.routeTask).not.toHaveBeenCalled();
  });
});
