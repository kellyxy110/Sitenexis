import { describe, it, expect, vi, beforeEach } from 'vitest';

// Same cold-import headroom as intelligence-commands.test.ts — this file
// exercises the real canonical chain (scorecard/issues/fixplan/evidence)
// plus the real, pure buildFixPlan/dedupeFindings from @sitenexis/analyzers.
vi.setConfig({ testTimeout: 20000 });

const h = vi.hoisted(() => ({
  // Identity / connection
  getConnectionByTelegramUserId: vi.fn(),
  touchLastInteraction: vi.fn(),
  getLatestUsableAuditForDomainAndUser: vi.fn(),
  getScoutAnalysis: vi.fn(),
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
  // AI boundary — answerScoutQuestion is the ONLY one of these that Scout
  // may ever invoke; callAI/routeTask/routeTaskWithBynara must stay untouched.
  answerScoutQuestion: vi.fn(),
  callAI: vi.fn(),
  routeTask: vi.fn(),
  routeTaskWithBynara: vi.fn(),
  // Redis (executive-summary fallback path)
  getRedisUrl: vi.fn(),
  createRedisClient: vi.fn(),
  // Rate limiting
  rateLimit: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/lib/env', () => ({ env: { NEXT_PUBLIC_APP_URL: 'https://sitenexis.example' } }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: h.rateLimit }));

vi.mock('@sitenexis/db', () => ({
  getConnectionByTelegramUserId: h.getConnectionByTelegramUserId,
  touchLastInteraction: h.touchLastInteraction,
  getLatestUsableAuditForDomainAndUser: h.getLatestUsableAuditForDomainAndUser,
  getScoutAnalysis: h.getScoutAnalysis,
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

// buildFixPlan/dedupeFindings stay REAL (pure functions) — only the AI
// boundary is replaced, so context assembled for Scout is built from the
// same real canonical service chain T4 already proved is LLM-free.
vi.mock('@sitenexis/analyzers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@sitenexis/analyzers')>();
  return {
    ...actual,
    answerScoutQuestion: h.answerScoutQuestion,
    callAI: h.callAI,
    routeTask: h.routeTask,
    routeTaskWithBynara: h.routeTaskWithBynara,
  };
});

const { commandScout } = await import('../scout-command');
const { commandScores } = await import('../intelligence-commands');

const linkedConnection = {
  id: 'conn-1', telegramUserId: '111', telegramChatId: '111', siteNexisUserId: 'user-A',
  status: 'linked' as const, activeDomain: 'example.com', linkedAt: new Date(), lastInteractionAt: null,
};

const auditRecord = { id: 'audit-1', domain: 'example.com', status: 'complete', userId: 'user-A' };

const v1Scores = { overall: 80, seoScore: 75, aiScore: 82, schemaScore: 70, linkGraphScore: 65, performanceScore: 60, breakdown: {} };

const v2Scores = {
  aiVisibilityScore: 78, machineReadabilityScore: 74, entityConfidenceScore: 69,
  retrievalReadinessScore: 81, citationProbabilityScore: 55, semanticTrustScore: 90,
  recommendationConfidence: 60,
};

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

const scoutAnalysis = {
  state: 'complete', timestamp: new Date().toISOString(), pageIntents: [], intentDistribution: [],
  dominantIntent: 'informational', intentCoverageScore: 65, intentAlignmentScore: 58,
  recommendations: [], pipeline: {},
};

const defaultScoutAnswer = {
  answer: 'Your biggest opportunity is fixing the missing title tag.',
  observedEvidence: ['Machine Trust overall: 40/100', '1 critical issue currently open'],
  derivedIntelligence: ['Entity Credibility Consistency is the lowest Machine Trust sub-score'],
  interpretation: 'Fixing the title tag is the fastest lever available right now.',
  evidenceAvailable: true,
};

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
  h.getScoutAnalysis.mockResolvedValue(scoutAnalysis);
  h.rateLimit.mockResolvedValue({ ok: true, remaining: 4, reset: 0, headers: {} });
  h.answerScoutQuestion.mockResolvedValue(defaultScoutAnswer);
}

beforeEach(() => {
  vi.clearAllMocks();
  setHappyPathDefaults();
});

describe('usage / no question asked', () => {
  it('returns usage help without touching rate limiting or the connection lookup', async () => {
    const reply = await commandScout('111', []);
    expect(reply).toContain('Ask a question');
    expect(h.rateLimit).not.toHaveBeenCalled();
    expect(h.getConnectionByTelegramUserId).not.toHaveBeenCalled();
  });

  it('treats a whitespace-only question the same as no question', async () => {
    const reply = await commandScout('111', ['   ']);
    expect(reply).toContain('Ask a question');
  });
});

describe('linked/unlinked user', () => {
  it('an unlinked Telegram user gets a "not connected" message and Scout is never invoked', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue(null);
    const reply = await commandScout('999', ['What', 'should', 'I', 'fix', 'first?']);
    expect(reply).toContain('Not connected');
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });

  it('a linked user with a valid audit gets a real Scout answer', async () => {
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix', 'first?']);
    expect(reply).toContain('Your biggest opportunity is fixing the missing title tag.');
  });
});

describe('no active domain', () => {
  it('reports no active website selected and never invokes Scout', async () => {
    h.getConnectionByTelegramUserId.mockResolvedValue({ ...linkedConnection, activeDomain: null });
    const reply = await commandScout('111', ['Why', 'is', 'my', 'score', 'low?']);
    expect(reply).toContain('No active website selected');
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });
});

describe('no audit', () => {
  it('reports no audits found and never invokes Scout', async () => {
    h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: null, isPartial: false, latestAny: null });
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply).toContain('No SiteNexis audits found');
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });
});

describe('evidence unavailable at the audit level', () => {
  it('reports insufficient data and never calls Scout when the audit record disappears between resolution and grounding', async () => {
    // getLatestUsableAuditForDomainAndUser found an audit id, but the
    // canonical services all key off getAuditById — simulate the audit
    // having been archived/deleted in between.
    h.getAuditById.mockResolvedValue(null);
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply.toLowerCase()).toContain("isn’t enough audit data");
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });
});

describe('evidence unavailable in the model response', () => {
  it('surfaces the "did not have enough data" caveat when Scout itself reports evidenceAvailable: false', async () => {
    h.answerScoutQuestion.mockResolvedValue({ ...defaultScoutAnswer, evidenceAvailable: false });
    const reply = await commandScout('111', ['What', 'about', 'my', 'voice', 'search', 'ranking?']);
    expect(reply).toContain('did not have enough audit data');
  });
});

describe('unauthorized domain / user isolation', () => {
  it('scopes the audit lookup by the CALLING user\'s own siteNexisUserId, never a different one', async () => {
    const otherUserConnection = { ...linkedConnection, telegramUserId: '222', siteNexisUserId: 'user-B', activeDomain: 'example.com' };
    h.getConnectionByTelegramUserId.mockImplementation((tgId: string) =>
      Promise.resolve(tgId === '222' ? otherUserConnection : linkedConnection),
    );
    h.getLatestUsableAuditForDomainAndUser.mockImplementation((_domain: string, userId: string) =>
      Promise.resolve(userId === 'user-A'
        ? { audit: auditRecord, isPartial: false, latestAny: { status: 'complete', createdAt: new Date() } }
        : { audit: null, isPartial: false, latestAny: null }),
    );

    const reply = await commandScout('222', ['What', 'should', 'I', 'fix?']);
    expect(h.getLatestUsableAuditForDomainAndUser).toHaveBeenCalledWith('example.com', 'user-B');
    expect(reply).toContain('No SiteNexis audits found');
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });

  it('same domain string, different user: user-A still resolves their own audit normally', async () => {
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(h.getLatestUsableAuditForDomainAndUser).toHaveBeenCalledWith('example.com', 'user-A');
    expect(reply).toContain('Your biggest opportunity');
  });
});

describe('correct audit grounding', () => {
  it('passes the real canonical scores/issues/evidence into the Scout context, never fabricated values', async () => {
    await commandScout('111', ['Why', 'is', 'my', 'Machine', 'Trust', 'low?']);
    expect(h.answerScoutQuestion).toHaveBeenCalledTimes(1);
    const [context, question] = h.answerScoutQuestion.mock.calls[0] as [Record<string, unknown>, string];

    expect(question).toBe('Why is my Machine Trust low?');
    expect(context.domain).toBe('example.com');
    const scores = context.scores as Record<string, unknown>;
    expect(scores.machineTrustOverall).toBe(40); // machine_trust_scores.overall, never semanticTrustScore (90)
    expect(scores.semanticTrust).toBe(90);
    expect(context.topCriticalIssues).toEqual(['Missing title tag']);

    const evidence = context.evidence as Record<string, unknown>;
    expect(evidence.primaryEntityName).toBe('Example Corp');
    expect(evidence.pageCount).toBe(1);

    const intent = context.scoutIntent as Record<string, unknown>;
    expect(intent.dominantIntent).toBe('informational');
  });

  it('never fabricates a score as 0 when it is null — passes null through to context', async () => {
    h.getMachineTrustScore.mockResolvedValue(null);
    await commandScout('111', ['How', 'is', 'my', 'Machine', 'Trust?']);
    const [context] = h.answerScoutQuestion.mock.calls[0] as [Record<string, unknown>];
    const scores = context.scores as Record<string, unknown>;
    expect(scores.machineTrustOverall).toBeNull();
  });
});

describe('partial audit semantics', () => {
  it('flags the partial audit in both the rendered reply and the grounding context', async () => {
    h.getLatestUsableAuditForDomainAndUser.mockResolvedValue({ audit: auditRecord, isPartial: true, latestAny: { status: 'partial', createdAt: new Date() } });
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply).toContain('PARTIAL AUDIT');
    const [context] = h.answerScoutQuestion.mock.calls[0] as [Record<string, unknown>];
    expect(context.isPartialAudit).toBe(true);
  });
});

describe('rate limiting', () => {
  it('declines the request and never resolves an audit or calls Scout once the limit is hit', async () => {
    h.rateLimit.mockResolvedValue({ ok: false, remaining: 0, reset: 0, headers: {} });
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply.toLowerCase()).toContain('try again');
    expect(h.getLatestUsableAuditForDomainAndUser).not.toHaveBeenCalled();
    expect(h.answerScoutQuestion).not.toHaveBeenCalled();
  });

  it('rate-limits per calling Telegram user id', async () => {
    await commandScout('111', ['Hi']);
    expect(h.rateLimit).toHaveBeenCalledWith('telegram:scout', '111', expect.objectContaining({ limit: expect.any(Number), windowSec: expect.any(Number) }));
  });
});

describe('AI provider failure / Scout unavailable', () => {
  it('degrades gracefully with a generic message and never leaks the raw error text', async () => {
    h.answerScoutQuestion.mockRejectedValue(new Error('OpenRouter 500: upstream connection reset by peer at 10.0.4.12'));
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply).toContain('temporarily unavailable');
    expect(reply).not.toContain('10.0.4.12');
    expect(reply).not.toContain('OpenRouter 500');
    expect(reply).toContain('/scores');
  });
});

describe('HTML escaping', () => {
  it('escapes attacker-controlled text returned by Scout before it reaches the Telegram HTML message', async () => {
    h.answerScoutQuestion.mockResolvedValue({
      ...defaultScoutAnswer,
      answer: '<script>alert(1)</script>',
      observedEvidence: ['<img src=x onerror=alert(2)>'],
    });
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply).not.toContain('<script>');
    expect(reply).not.toContain('<img');
    expect(reply).toContain('&lt;script&gt;');
  });
});

describe('no secret leakage', () => {
  it('a normal Scout reply never contains a raw API key, bot token, or connection string pattern', async () => {
    const reply = await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(reply).not.toMatch(/sk-[a-zA-Z0-9]{20,}/);
    expect(reply).not.toMatch(/postgres:\/\/[^\s]+:[^\s]+@/);
    expect(reply).not.toMatch(/\b\d{6,}:[A-Za-z0-9_-]{30,}\b/);
  });
});

describe('T4 zero-LLM guarantee still holds with Scout loaded', () => {
  it('an ordinary intelligence command (e.g. /scores) never calls callAI/routeTask, even though Scout uses the same mocked analyzers module', async () => {
    await commandScores('111');
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.routeTaskWithBynara).not.toHaveBeenCalled();
  });

  it('Scout itself never calls the raw callAI/routeTask primitives directly — only through answerScoutQuestion', async () => {
    await commandScout('111', ['What', 'should', 'I', 'fix?']);
    expect(h.callAI).not.toHaveBeenCalled();
    expect(h.routeTask).not.toHaveBeenCalled();
    expect(h.routeTaskWithBynara).not.toHaveBeenCalled();
    expect(h.answerScoutQuestion).toHaveBeenCalledTimes(1);
  });
});
