import { describe, it, expect, vi, beforeEach } from 'vitest';

// importOriginal pulls in the real @sitenexis/analyzers barrel (needed for
// real dedupeFindings) — under full-suite parallel load that alone can
// exceed the default 5s test timeout.
vi.setConfig({ testTimeout: 30_000 });

const h = vi.hoisted(() => ({
  getAuditWithResults: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getMachineTrustScore: vi.fn(),
  getTemporalAuthorityRecord: vi.fn(),
  getRetrievalSimulations: vi.fn(),
  getRecommendationSurfaceMap: vi.fn(),
  claimReportGeneration: vi.fn(),
  saveGeneratedReport: vi.fn(),
  markReportGenerationFailed: vi.fn(),
  executiveSummaryPrompt: vi.fn(),
  hybridAuditReportPrompt: vi.fn(),
  routeTask: vi.fn(),
  callAI: vi.fn(),
  parseAIResponse: vi.fn(),
  getRedisUrl: vi.fn(),
  redisSet: vi.fn(),
}));

vi.mock('@sitenexis/db', () => ({
  getAuditWithResults: h.getAuditWithResults,
  getIssuesByAudit: h.getIssuesByAudit,
  getMachineTrustScore: h.getMachineTrustScore,
  getTemporalAuthorityRecord: h.getTemporalAuthorityRecord,
  getRetrievalSimulations: h.getRetrievalSimulations,
  getRecommendationSurfaceMap: h.getRecommendationSurfaceMap,
  claimReportGeneration: h.claimReportGeneration,
  saveGeneratedReport: h.saveGeneratedReport,
  markReportGenerationFailed: h.markReportGenerationFailed,
}));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: () => ({ set: h.redisSet }),
}));
vi.mock('@sitenexis/analyzers', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    executiveSummaryPrompt: h.executiveSummaryPrompt,
    hybridAuditReportPrompt: h.hybridAuditReportPrompt,
    routeTask: h.routeTask,
    callAI: h.callAI,
    parseAIResponse: h.parseAIResponse,
  };
});

const { generateAndPersistIntelligenceReport } = await import('../report-generation-service');

/**
 * `routeTask` is called twice per generation (once per prompt), sequentially
 * awaited — but positional `.mockResolvedValueOnce().mockResolvedValueOnce()`
 * chaining is fragile here: `vi.clearAllMocks()` only clears call history,
 * not queued once-implementations, so a leftover queued value can silently
 * carry across tests. Branching on the real, distinct system-prompt content
 * is deterministic regardless of call count/order.
 */
function mockRouteTaskByPrompt(execResult: unknown, narrativeResult: unknown): void {
  h.routeTask.mockImplementation((_task: string, system: string) => {
    if (system.includes('Executive Audit Narrator')) return Promise.resolve(execResult);
    if (system.includes('Hybrid Audit Narrator')) return Promise.resolve(narrativeResult);
    return Promise.resolve(null);
  });
}

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
  h.claimReportGeneration.mockResolvedValue(true);
  h.getAuditWithResults.mockResolvedValue({
    status: 'complete', domain: 'example.com', pageCount: 10,
    scores: { seoScore: 80, aiScore: 70, overall: 75 },
    aiVisibilityScores: { aiVisibilityScore: 70, entityConfidenceScore: 60, citationProbabilityScore: 65, machineReadabilityScore: 75, semanticTrustScore: 68 },
    entities: [],
  });
  h.getIssuesByAudit.mockResolvedValue([]);
  h.getMachineTrustScore.mockResolvedValue(null);
  h.getTemporalAuthorityRecord.mockResolvedValue(null);
  h.getRetrievalSimulations.mockResolvedValue([]);
  h.getRecommendationSurfaceMap.mockResolvedValue(null);
  h.executiveSummaryPrompt.mockReturnValue('EXEC_PROMPT');
  h.hybridAuditReportPrompt.mockReturnValue('NARRATIVE_PROMPT');
  h.routeTask.mockResolvedValue({ headline: 'ok' });
  h.getRedisUrl.mockReturnValue('redis://localhost:6379');
});

describe('generateAndPersistIntelligenceReport — idempotency', () => {
  it('does nothing when the idempotency claim is not won — no context assembly, no AI call, no save', async () => {
    h.claimReportGeneration.mockResolvedValue(false);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('skipped');
    expect(h.getAuditWithResults).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.saveGeneratedReport).not.toHaveBeenCalled();
  });
});

describe('generateAndPersistIntelligenceReport — success paths', () => {
  it('persists both artifacts and reports "ready" when both generate successfully', async () => {
    mockRouteTaskByPrompt({ composite_score: 8.1 }, { summary: 'narrative ok' });

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('ready');
    expect(h.saveGeneratedReport).toHaveBeenCalledTimes(1);
    const saved = h.saveGeneratedReport.mock.calls[0]![1] as Record<string, unknown>;
    expect(saved.executiveSummary).toBeTruthy();
    expect(saved.narrativeReport).toBeTruthy();
  });

  it('writes through to the exact legacy Redis cache keys the dashboard/Telegram fallback reads', async () => {
    mockRouteTaskByPrompt({ composite_score: 8.1 }, { summary: 'narrative ok' });

    await generateAndPersistIntelligenceReport('audit-1');

    const keys = h.redisSet.mock.calls.map((c) => c[0]);
    expect(keys).toContain('exec-summary:audit-1:v1.0');
    expect(keys).toContain('narrative:audit-1:v4.1');
  });

  it('reports "partial" and still saves when only the executive summary succeeds', async () => {
    mockRouteTaskByPrompt({ composite_score: 8.1 }, null);
    h.callAI.mockResolvedValue(null);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('partial');
    const saved = h.saveGeneratedReport.mock.calls[0]![1] as Record<string, unknown>;
    expect(saved.executiveSummary).toBeTruthy();
    expect(saved.narrativeReport).toBeUndefined();
  });

  it('reports "partial" and still saves when only the narrative report succeeds', async () => {
    mockRouteTaskByPrompt(null, { summary: 'ok' });
    h.callAI.mockResolvedValue(null);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('partial');
    const saved = h.saveGeneratedReport.mock.calls[0]![1] as Record<string, unknown>;
    expect(saved.executiveSummary).toBeUndefined();
    expect(saved.narrativeReport).toBeTruthy();
  });
});

describe('generateAndPersistIntelligenceReport — failure paths', () => {
  it('marks the report failed (never throws) when the audit cannot be found at generation time', async () => {
    h.getAuditWithResults.mockResolvedValue(null);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('failed');
    expect(h.markReportGenerationFailed).toHaveBeenCalledWith('audit-1', expect.any(String));
    expect(h.saveGeneratedReport).not.toHaveBeenCalled();
  });

  it('marks the report failed when both generators return nothing', async () => {
    h.routeTask.mockResolvedValue(null);
    h.callAI.mockResolvedValue(null);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('failed');
    expect(h.markReportGenerationFailed).toHaveBeenCalled();
    expect(h.saveGeneratedReport).not.toHaveBeenCalled();
  });

  it('a provider timeout/throw on one artifact does not prevent the other artifact from being generated and saved', async () => {
    h.routeTask.mockImplementation((_task: string, system: string) => {
      if (system.includes('Executive Audit Narrator')) return Promise.reject(new Error('provider timeout'));
      if (system.includes('Hybrid Audit Narrator')) return Promise.resolve({ summary: 'narrative still worked' });
      return Promise.resolve(null);
    });
    h.callAI.mockResolvedValue(null);

    const result = await generateAndPersistIntelligenceReport('audit-1');

    expect(result.status).toBe('partial');
    const saved = h.saveGeneratedReport.mock.calls[0]![1] as Record<string, unknown>;
    expect(saved.narrativeReport).toBeTruthy();
  });
});

describe('generateAndPersistIntelligenceReport — context assembly / dedup wiring', () => {
  it('feeds both prompts a deduplicated, page-annotated topIssues list, not raw per-page rows', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      issue({ id: 'i2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
      issue({ id: 'i3', pageUrl: 'https://x.com/c', message: 'Title is 79 chars (max 70)' }),
    ]);
    mockRouteTaskByPrompt({ composite_score: 8.1 }, { summary: 'ok' });

    await generateAndPersistIntelligenceReport('audit-1');

    expect(h.executiveSummaryPrompt).toHaveBeenCalledTimes(1);
    const execContext = h.executiveSummaryPrompt.mock.calls[0]![0] as { topIssues: Array<{ message: string }> };
    expect(execContext.topIssues).toHaveLength(1);
    expect(execContext.topIssues[0]!.message).toContain('affects 3 pages');

    const narrativeContext = h.hybridAuditReportPrompt.mock.calls[0]![0] as { topIssues: Array<{ message: string }> };
    expect(narrativeContext.topIssues).toHaveLength(1);
  });

  it('keeps two genuinely different issue types as two separate topIssues entries', async () => {
    h.getIssuesByAudit.mockResolvedValueOnce([
      issue({ id: 'i1', type: 'missing_h1', message: 'No <h1> tag found', pageUrl: 'https://x.com/a' }),
      issue({ id: 'i2', type: 'missing_title', message: 'No <title> tag found', recommendation: 'Add a descriptive title tag.', pageUrl: 'https://x.com/b' }),
    ]);
    mockRouteTaskByPrompt({ composite_score: 8.1 }, { summary: 'ok' });

    await generateAndPersistIntelligenceReport('audit-1');

    const context = h.executiveSummaryPrompt.mock.calls[0]![0] as { topIssues: unknown[] };
    expect(context.topIssues).toHaveLength(2);
  });
});
