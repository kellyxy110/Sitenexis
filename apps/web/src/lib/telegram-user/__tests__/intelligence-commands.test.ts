import { describe, it, expect, vi, beforeEach } from 'vitest';

// The first call in this file that touches @sitenexis/analyzers (dedupeFindings
// / buildFixPlan, kept real — only callAI/routeTask are mocked below) pays a
// one-time cold-import cost that can exceed Vitest's 5s default, especially
// running alongside the rest of the suite. Every test here does real,
// mocked-DB-backed work (not a hang) — just give the whole file more room.
vi.setConfig({ testTimeout: 20000 });

const h = vi.hoisted(() => ({
  // Identity / connection
  getConnectionByTelegramUserId: vi.fn(),
  touchLastInteraction: vi.fn(),
  getLatestUsableAuditForDomainAndUser: vi.fn(),
  getLatestTwoCompleteAuditsForDomainAndUser: vi.fn(),
  // Canonical score/evidence sources
  getAuditById: vi.fn(),
  getAuditScores: vi.fn(),
  getAIVisibilityScore: vi.fn(),
  getMachineTrustScore: vi.fn(),
  getSIIScore: vi.fn(),
  getPagesByAudit: vi.fn(),
  getEntitiesByAudit: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getAuditIntelligenceReport: vi.fn(),
  // AI boundary — must NEVER be invoked by any command in this file
  callAI: vi.fn(),
  routeTask: vi.fn(),
  routeTaskWithBynara: vi.fn(),
  // Redis (executive-summary/narrative-report fallback path)
  getRedisUrl: vi.fn(),
  createRedisClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://sitenexis.example' } }));

vi.mock('@sitenexis/db', () => ({
  getConnectionByTelegramUserId: h.getConnectionByTelegramUserId,
  touchLastInteraction: h.touchLastInteraction,
  getLatestUsableAuditForDomainAndUser: h.getLatestUsableAuditForDomainAndUser,
  getLatestTwoCompleteAuditsForDomainAndUser: h.getLatestTwoCompleteAuditsForDomainAndUser,
  getAuditById: h.getAuditById,
  getAuditScores: h.getAuditScores,
  getAIVisibilityScore: h.getAIVisibilityScore,
  getMachineTrustScore: h.getMachineTrustScore,
  getSIIScore: h.getSIIScore,
  getPagesByAudit: h.getPagesByAudit,
  getEntitiesByAudit: h.getEntitiesByAudit,
  getIssuesByAudit: h.getIssuesByAudit,
  getAuditIntelligenceReport: h.getAuditIntelligenceReport,
}));

vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: h.createRedisClient,
}));

// buildFixPlan / dedupeFindings are kept REAL (pure functions) — only the
// AI boundary (callAI/routeTask) is replaced with spies. This proves the
// full canonical service chain (audit-intelligence/* → @sitenexis/analyzers)
// never reaches the LLM for any of these commands.
vi.mock('@sitenexis/analyzers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sitenexis/analyzers')>();
  return { ...actual, callAI: h.callAI, routeTask: h.routeTask, routeTaskWithBynara: h.routeTaskWithBynara };
});

const {
  commandScores, commandAiVisibility, commandRetrieval, commandMachineTrust,
  commandCitation, commandEntity, commandSeo, commandSchema, commandPerformance,
  commandLinks, commandIssues, commandCritical, commandFixplan, commandReport,
  commandCompare,
} = await import('../intelligence-commands');

const linkedConnection = {
  id: 'conn-1', telegramUserId: '111', telegramChatId: '111', siteNexisUserId: 'user-A',
  status: 'linked' as const, activeDomain: 'example.com', linkedAt: new Date(), lastInteractionAt: null,
};

const auditRecord = { id: 'audit-1', domain: 'example.com', status: 'complete', userId: 'user-A' };

const v1Scores = {
  overall: 80, seoScore: 75, aiScore: 82, schemaScore: 70, linkGraphScore: 65, performanceScore: 60,
  breakdown: {},
};

const v2Scores = {
  aiVisibilityScore: 78, machineReadabilityScore: 74, entityConfidenceScore: 69,
  retrievalReadinessScore: 81, citationProbabilityScore: 55, semanticTrustScore: 90,
  recommendationConfidence: 60,
};

// Deliberately DIFFERENT from semanticTrustScore (90) above — the regression
// this whole suite exists to prevent is Machine Trust silently reading
// semanticTrustScore instead of its own overall field.
const machineTrustScores = {
  overall: 40, entityCredibilityScore: 50, schemaTrustAlignmentScore: 45,
  externalValidationScore: 35, contradictionAbsenceScore: null,
};

const siiScores = { sii_score: 72, confidence: 0.8 };

const entities = [{ name: 'Example Corp', sameAsUrls: ['https://en.wikipedia.org/wiki/Example'] }];

const pages = [{
  url: 'https://example.com/', statusCode: 200, isIndexable: true, robotsDirective: null,
  canonicalUrl: 'https://example.com/', canonicalValidity: 'valid', h1: 'Welcome', schemaData: [{ '@type': 'Organization' }],
}];

const issues = [
  { id: 'i1', module: 'seo', type: 'missing_title', severity: 'critical', message: 'Missing title tag', recommendation: 'Add a title tag', pageUrl: '/', problem: null, solution: null, fixCode: null, fixLanguage: null },
  { id: 'i2', module: 'schema', type: 'missing_schema', severity: 'warning', message: 'No Organization schema', recommendation: 'Add Organization schema', pageUrl: '/', problem: null, solution: null, fixCode: null, fixLanguage: null },
];

function setHappyPathDefaults(): void {
  h.getConnectionByTelegramUserId.mockResolvedValue(linkedConnection);
  h.touchLastInteraction.mockResolvedValue(undefined);
  h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: auditRecord, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } });
  h.getAuditById.mockResolvedValue(auditRecord);
  h.getAuditScores.mockResolvedValue(v1Scores);
  h.getAIVisibilityScore.mockResolvedValue(v2Scores);
  h.getMachineTrustScore.mockResolvedValue(machineTrustScores);
  h.getSIIScore.mockResolvedValue(siiScores);
  h.getPagesByAudit.mockResolvedValue(pages);
  h.getEntitiesByAudit.mockResolvedValue(entities);
  h.getIssuesByAudit.mockResolvedValue(issues);
  h.getAuditIntelligenceReport.mockResolvedValue(null);
  h.getRedisUrl.mockReturnValue(null);
  h.createRedisClient.mockReturnValue({ get: vi.fn().mockResolvedValue(null) });
}

beforeEach(() => {
  vi.clearAllMocks();
  setHappyPathDefaults();
});

const ALL_COMMANDS: Array<{ name: string; fn: (uid: string) => Promise<string> }> = [
  { name: 'scores', fn: commandScores },
  { name: 'aivisibility', fn: commandAiVisibility },
  { name: 'retrieval', fn: commandRetrieval },
  { name: 'machinetrust', fn: commandMachineTrust },
  { name: 'citation', fn: commandCitation },
  { name: 'entity', fn: commandEntity },
  { name: 'seo', fn: commandSeo },
  { name: 'schema', fn: commandSchema },
  { name: 'performance', fn: commandPerformance },
  { name: 'links', fn: commandLinks },
  { name: 'issues', fn: commandIssues },
  { name: 'critical', fn: commandCritical },
  { name: 'fixplan', fn: commandFixplan },
  { name: 'report', fn: commandReport },
  { name: 'compare', fn: commandCompare },
];

describe('every canonical intelligence command — smoke test', () => {
  it.each(ALL_COMMANDS)('$name resolves without throwing and returns non-empty HTML text', async ({ fn }) => {
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([
      { id: 'audit-2', completedAt: new Date('2026-02-01') },
      { id: 'audit-1', completedAt: new Date('2026-01-01') },
    ]);
    const reply = await fn('111');
    expect(typeof reply).toBe('string');
    expect(reply.length).toBeGreaterThan(0);
  });
});

describe('zero LLM calls — routeTask/callAI must never be invoked by any of these commands', () => {
  it('never calls callAI or routeTask across all 15 canonical commands', async () => {
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([
      { id: 'audit-2', completedAt: new Date('2026-02-01') },
      { id: 'audit-1', completedAt: new Date('2026-01-01') },
    ]);
    for (const { fn } of ALL_COMMANDS) {
      await fn('111');
    }
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.routeTaskWithBynara).not.toHaveBeenCalled();
  });
});

describe('Machine Trust regression guard', () => {
  it('reads machine_trust_scores.overall, never semanticTrustScore, even though they differ', async () => {
    const reply = await commandMachineTrust('111');
    expect(reply).toContain('Overall: 40'); // machineTrust.overall
    expect(reply).not.toContain('Overall: 90'); // v2.semanticTrustScore — must never leak in here
  });

  it('/scores lists Machine Trust Overall as 40, distinct from the V2 Semantic Trust row (90)', async () => {
    const reply = await commandScores('111');
    expect(reply).toMatch(/Layer 4 — Machine Trust[\s\S]*Overall: 40/);
    expect(reply).toMatch(/Semantic Trust: 90/);
  });
});

describe('unavailable data never becomes zero', () => {
  it('/machinetrust reports a truthful "not computed" message when Machine Trust has never run — not 0/100', async () => {
    h.getMachineTrustScore.mockResolvedValue(null);
    const reply = await commandMachineTrust('111');
    expect(reply).not.toMatch(/Overall: 0/);
    expect(reply.toLowerCase()).toContain('not been computed');
  });

  it('renders a null contradictionAbsenceScore as "unavailable", not 0', async () => {
    const reply = await commandMachineTrust('111');
    expect(reply).toContain('Contradiction Absence: unavailable');
    expect(reply).not.toContain('Contradiction Absence: 0');
  });

  it('/aivisibility reports "unavailable" scores when V2 has not been computed, never fabricating 0', async () => {
    h.getAIVisibilityScore.mockResolvedValue(null);
    const reply = await commandAiVisibility('111');
    expect(reply).toContain('unavailable');
    expect(reply).not.toMatch(/AI Visibility Score: 0/);
  });

  it('/seo reports "unavailable" when V1 scores do not exist, never fabricating 0', async () => {
    h.getAuditScores.mockResolvedValue(null);
    const reply = await commandSeo('111');
    expect(reply).toContain('unavailable');
  });
});

describe('user isolation — one Telegram user can never resolve another user\'s audit intelligence', () => {
  it('scopes the audit lookup by the CALLING user\'s own siteNexisUserId, never a different one', async () => {
    const otherUserConnection = { ...linkedConnection, telegramUserId: '222', siteNexisUserId: 'user-B', activeDomain: 'example.com' };
    h.getConnectionByTelegramUserId.mockImplementation((tgId: string) =>
      Promise.resolve(tgId === '222' ? otherUserConnection : linkedConnection),
    );
    // Simulate the real DB behavior: the userId-scoped query returns nothing
    // for user-B even though the domain string is identical to user-A's.
    h.getLatestUsableAuditForDomainAndUser.mockImplementation((_domain: string, userId: string) =>
      Promise.resolve(userId === 'user-A'
        ? { audit: auditRecord, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } }
        : { audit: null, isPartial: false, latestAny: null }),
    );

    await commandScores('222');
    expect(h.getLatestUsableAuditForDomainAndUser).toHaveBeenCalledWith('example.com', 'user-B');
    const reply = await commandScores('222');
    expect(reply).toContain('No SiteNexis audits found');
  });

  it('/compare scopes the two-audit lookup by the calling user, never a different user', async () => {
    const otherUserConnection = { ...linkedConnection, telegramUserId: '222', siteNexisUserId: 'user-B', activeDomain: 'example.com' };
    h.getConnectionByTelegramUserId.mockImplementation((tgId: string) =>
      Promise.resolve(tgId === '222' ? otherUserConnection : linkedConnection),
    );
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([]);

    await commandCompare('222');
    expect(h.getLatestTwoCompleteAuditsForDomainAndUser).toHaveBeenCalledWith('example.com', 'user-B');
  });

  it('an unlinked Telegram user gets a "not connected" message, never falls through to any audit data', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const reply = await commandScores('999');
    expect(reply).toContain('Not connected');
    expect(h.getLatestUsableAuditForDomainAndUser).not.toHaveBeenCalled();
  });
});

describe('HTML escaping', () => {
  it('escapes attacker-controlled issue text before it reaches the Telegram HTML message', async () => {
    h.getIssuesByAudit.mockResolvedValue([
      { id: 'i1', module: 'seo', type: 'x', severity: 'critical', message: '<script>alert(1)</script>', recommendation: 'fix it', pageUrl: '/', problem: null, solution: null, fixCode: null, fixLanguage: null },
    ]);
    const reply = await commandIssues('111');
    expect(reply).not.toContain('<script>');
    expect(reply).toContain('&lt;script&gt;');
  });
});

describe('partial audit semantics', () => {
  it('shows the PARTIAL AUDIT banner and still surfaces whatever scores exist', async () => {
    h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: auditRecord, isPartial: true, latestAny: { status: 'partial', createdAt: new Date() } });
    const reply = await commandScores('111');
    expect(reply).toContain('PARTIAL AUDIT');
    expect(reply).toContain('unavailable, not zero');
  });

  it('reports "currently running" truthfully instead of stale or fabricated data', async () => {
    h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: null, isPartial: false, latestAny: { status: 'running', createdAt: new Date() } });
    const reply = await commandScores('111');
    expect(reply).toContain('currently running');
  });

  it('reports a failed audit truthfully', async () => {
    h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: null, isPartial: false, latestAny: { status: 'failed', createdAt: new Date() } });
    const reply = await commandScores('111');
    expect(reply).toContain('failed');
  });
});

describe('/report — persisted AuditIntelligenceReport, survives Redis loss', () => {
  const readyReport = {
    id: 'rep-1', auditId: 'audit-1', status: 'ready' as const,
    executiveSummary: {
      composite_score: 8.2, composite_label: 'Strong', overall_verdict: 'Solid AI visibility posture.',
      sections: [{ name: 'Entity', issues: ['Inconsistent NAP data'] }],
      top_recommendations: ['Add Organization schema to the homepage.'],
    },
    executiveSummaryVersion: 'v1', narrativeReport: { summary: 'Overview text.', sections: [] }, narrativeReportVersion: 'v4.1',
    provider: 'anthropic', model: 'claude', lastError: null, generatedAt: new Date(), createdAt: new Date(), updatedAt: new Date(),
  };

  it('reads the report from Postgres and never touches Redis when the DB row is present', async () => {
    h.getAuditIntelligenceReport.mockResolvedValue(readyReport);
    const reply = await commandReport('111');
    expect(reply).toContain('Strong');
    expect(reply).toContain('Solid AI visibility posture');
    expect(h.createRedisClient).not.toHaveBeenCalled();
  });

  it('still returns the persisted report even when Redis itself is completely down', async () => {
    h.getAuditIntelligenceReport.mockResolvedValue(readyReport);
    h.getRedisUrl.mockImplementation(() => { throw new Error('Redis unreachable'); });
    const reply = await commandReport('111');
    expect(reply).toContain('Strong');
  });

  it('reports truthfully when the report has not been generated yet — never fabricates prose', async () => {
    h.getAuditIntelligenceReport.mockResolvedValue(null);
    h.getRedisUrl.mockReturnValue(null);
    const reply = await commandReport('111');
    expect(reply).toContain('not currently available');
  });
});

describe('/compare', () => {
  it('reports a truthful message when fewer than 2 completed audits exist, never a fake comparison', async () => {
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([{ id: 'audit-1', completedAt: new Date() }]);
    const reply = await commandCompare('111');
    expect(reply).toContain('Need at least 2 completed audits');
  });

  it('diffs scores between the two latest complete audits, newest vs oldest', async () => {
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([
      { id: 'audit-new', completedAt: new Date('2026-02-01') },
      { id: 'audit-old', completedAt: new Date('2026-01-01') },
    ]);
    h.getAuditById.mockImplementation((id: string) => Promise.resolve({ ...auditRecord, id }));
    h.getAuditScores.mockImplementation((id: string) => Promise.resolve(id === 'audit-new' ? { ...v1Scores, overall: 85 } : { ...v1Scores, overall: 70 }));
    h.getAIVisibilityScore.mockImplementation((id: string) => Promise.resolve(id === 'audit-new' ? { ...v2Scores, aiVisibilityScore: 90 } : { ...v2Scores, aiVisibilityScore: 60 }));

    const reply = await commandCompare('111');
    expect(reply).toContain('AI Visibility: 60 → 90 (▲ +30)');
    expect(reply).toContain('Technical SEO: 70 → 85 (▲ +15)');
  });
});

describe('no secret leakage', () => {
  it('command output never contains a raw API key, bot token, or connection string pattern', async () => {
    h.getLatestTwoCompleteAuditsForDomainAndUser.mockResolvedValue([
      { id: 'audit-2', completedAt: new Date('2026-02-01') },
      { id: 'audit-1', completedAt: new Date('2026-01-01') },
    ]);
    for (const { fn } of ALL_COMMANDS) {
      const reply = await fn('111');
      expect(reply).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
      expect(reply).not.toMatch(/postgres:\/\/[^\s]+:[^\s]+@/);
      expect(reply).not.toMatch(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/); // Telegram bot token shape
    }
  });
});
