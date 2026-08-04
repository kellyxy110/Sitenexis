import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  getAuditById: vi.fn(),
  getAuditIntelligenceReport: vi.fn(),
  getRedisUrl: vi.fn(),
  redisGet: vi.fn(),
  routeTask: vi.fn(),
  callAI: vi.fn(),
  parseAIResponse: vi.fn(),
  hybridAuditReportPrompt: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({ getAuditById: h.getAuditById, getAuditIntelligenceReport: h.getAuditIntelligenceReport }));
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
  h.getAuditIntelligenceReport.mockResolvedValue(null);
});

describe('getNarrativeReport — read-only / cost-isolation boundary', () => {
  it('returns null when the audit does not exist, without touching Redis, the DB report table, or any AI module', async () => {
    h.getAuditById.mockResolvedValue(null);

    const result = await getNarrativeReport('missing-audit');

    expect(result).toBeNull();
    expect(h.getAuditIntelligenceReport).not.toHaveBeenCalled();
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
  });

  it('prefers the persisted canonical report over Redis when both exist', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    const persisted = { auditId: 'a1', domain: 'truvyx.org', generatedAt: '2026-08-01T00:00:00Z', modelVersion: 'v4.1', summary: 'From DB.' };
    h.getAuditIntelligenceReport.mockResolvedValue({ narrativeReport: persisted });
    h.redisGet.mockResolvedValue(JSON.stringify({ ...persisted, summary: 'From Redis — should never be used.' }));

    const result = await getNarrativeReport('a1');

    expect(result?.data).toEqual(persisted);
    expect(h.redisGet).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
  });

  it('falls back to the legacy Redis cache when no persisted row exists', async () => {
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

  it('when neither the persisted row nor Redis has it, returns data: null and NEVER calls routeTask, callAI, or parseAIResponse — the non-negotiable guarantee', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.redisGet.mockResolvedValue(null);

    const result = await getNarrativeReport('a1');

    expect(result?.data).toBeNull();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.parseAIResponse).not.toHaveBeenCalled();
    expect(h.hybridAuditReportPrompt).not.toHaveBeenCalled();
  });

  it('treats a DB lookup failure as "not persisted" and still falls back to Redis rather than throwing', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getAuditIntelligenceReport.mockRejectedValue(new Error('db unreachable'));
    const cached = { auditId: 'a1', domain: 'truvyx.org', generatedAt: '2026-08-01T00:00:00Z', modelVersion: 'v4.1', summary: 'ok' };
    h.redisGet.mockResolvedValue(JSON.stringify(cached));

    const result = await getNarrativeReport('a1');

    expect(result?.data).toEqual(cached);
  });

  it('on total cache miss with Redis entirely unavailable, still returns data: null without ever attempting generation', async () => {
    h.getAuditById.mockResolvedValue({ id: 'a1', domain: 'truvyx.org', status: 'complete' });
    h.getRedisUrl.mockReturnValue(undefined);

    const result = await getNarrativeReport('a1');

    expect(result?.data).toBeNull();
    expect(h.routeTask).not.toHaveBeenCalled();
  });
});
