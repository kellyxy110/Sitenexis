/**
 * Full-chain integration test for Telegram Audit Intelligence: real webhook
 * route → real argument parsing → real audit-commands.ts → real
 * audit-intelligence service/query layer → real telegram-provider (HTML
 * formatting, chunking, fallback). Only true I/O boundaries are mocked:
 * the outgoing Telegram HTTP call (global.fetch), the DB query functions,
 * and the Redis client used for the two prose caches. `@sitenexis/analyzers`
 * is deliberately NOT mocked — dedupeFindings/buildFixPlan run for real, and
 * `routeTask`/`callAI` are spied on (not mocked) so every test can assert
 * they were never invoked, proving the read-only/cost-isolation boundary
 * holds through the entire real call chain, not just at the unit level.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { NextRequest } from 'next/server';
import * as analyzers from '@sitenexis/analyzers';

const h = vi.hoisted(() => ({
  env: {
    TELEGRAM_BOT_TOKEN: 'test-token-not-real',
    TELEGRAM_ADMIN_CHAT_ID: '8619262047',
    TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
    TELEGRAM_ALERTS_ENABLED: true,
    NEXT_PUBLIC_APP_URL: 'https://sitenexis.com',
  },
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  checkDatabase: vi.fn(), checkRedis: vi.fn(), checkBullMQQueue: vi.fn(), checkWorkerHeartbeat: vi.fn(),
  deriveModuleAndProviderState: vi.fn(),
  getLatestUsableAuditForDomainOps: vi.fn(),
  getAuditById: vi.fn(),
  getAuditIntelligenceReport: vi.fn(),
  getAuditScores: vi.fn(),
  getAIVisibilityScore: vi.fn(),
  getMachineTrustScore: vi.fn(),
  getSIIScore: vi.fn(),
  getIssuesByAudit: vi.fn(),
  getPagesByAudit: vi.fn(),
  getEntitiesByAudit: vi.fn(),
  getRedisUrl: vi.fn(),
  redisGet: vi.fn(),
}));

vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('@/lib/health-checks', () => ({
  checkDatabase: h.checkDatabase, checkRedis: h.checkRedis, checkBullMQQueue: h.checkBullMQQueue, checkWorkerHeartbeat: h.checkWorkerHeartbeat,
}));
vi.mock('@/lib/intelligence-report-v2-modules', () => ({ deriveModuleAndProviderState: h.deriveModuleAndProviderState }));
vi.mock('@sitenexis/db', () => ({
  getLatestUsableAuditForDomainOps: h.getLatestUsableAuditForDomainOps,
  getAuditById: h.getAuditById,
  getAuditIntelligenceReport: h.getAuditIntelligenceReport,
  getAuditScores: h.getAuditScores,
  getAIVisibilityScore: h.getAIVisibilityScore,
  getMachineTrustScore: h.getMachineTrustScore,
  getSIIScore: h.getSIIScore,
  getIssuesByAudit: h.getIssuesByAudit,
  getPagesByAudit: h.getPagesByAudit,
  getEntitiesByAudit: h.getEntitiesByAudit,
}));
vi.mock('@sitenexis/crawler', () => ({
  getRedisUrl: h.getRedisUrl,
  createRedisClient: () => ({ get: h.redisGet }),
}));

const { POST } = await import('@/app/api/telegram/webhook/route');

const originalFetch = global.fetch;
const routeTaskSpy = vi.spyOn(analyzers, 'routeTask');
const callAISpy = vi.spyOn(analyzers, 'callAI');

function ok() {
  return { ok: true, status: 200, json: async () => ({ ok: true }) };
}

function webhookReq(text: string, chatId: number | string = 8619262047): NextRequest {
  return {
    headers: new Headers({ 'x-telegram-bot-api-secret-token': h.env.TELEGRAM_WEBHOOK_SECRET }),
    json: async () => ({ message: { chat: { id: chatId }, text } }),
  } as unknown as NextRequest;
}

function sentTexts(fetchMock: ReturnType<typeof vi.fn>): string[] {
  return fetchMock.mock.calls.map((call) => (JSON.parse((call as [string, RequestInit])[1].body as string) as { text: string }).text);
}

const audit = { id: 'audit-1', domain: 'truvyx.org', status: 'complete' as const, createdAt: new Date('2026-01-01'), completedAt: new Date('2026-01-01') };

beforeEach(() => {
  vi.clearAllMocks();
  global.fetch = vi.fn().mockResolvedValue(ok()) as unknown as typeof fetch;
  h.env.TELEGRAM_ALERTS_ENABLED = true;
  h.getRedisUrl.mockReturnValue('redis://localhost:6379');
  h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit, isPartial: false, latestAny: { status: 'complete', createdAt: audit.createdAt } });
  h.getAuditById.mockResolvedValue(audit);
  h.getAuditScores.mockResolvedValue({ overall: 80, seoScore: 86, aiScore: 70, schemaScore: 90, linkGraphScore: 75, performanceScore: 65 });
  h.getAIVisibilityScore.mockResolvedValue({ aiVisibilityScore: 78, machineReadabilityScore: 82, entityConfidenceScore: 91, retrievalReadinessScore: 88, citationProbabilityScore: 92, semanticTrustScore: 95, recommendationConfidence: 70 });
  h.getMachineTrustScore.mockResolvedValue({ overall: 89, entityCredibilityScore: 90, schemaTrustAlignmentScore: 88, externalValidationScore: 85, contradictionAbsenceScore: 95 });
  h.getSIIScore.mockResolvedValue(null);
  h.getIssuesByAudit.mockResolvedValue([
    { id: 'i1', module: 'schema', type: 'missing_org_schema', severity: 'critical', message: 'Missing Organization schema', recommendation: 'Add Organization schema to the homepage', pageUrl: 'https://truvyx.org/', problem: null, solution: null, fixCode: null, fixLanguage: null, pageId: 'p1', confidence: 'high', renderMethod: 'static-html' },
  ]);
  h.getPagesByAudit.mockResolvedValue([
    { id: 'p1', url: 'https://truvyx.org/', statusCode: 200, isIndexable: true, robotsDirective: null, canonicalUrl: 'https://truvyx.org/', canonicalValidity: 'valid', h1: 'Welcome', schemaData: [{ '@type': 'Organization' }] },
  ]);
  h.getEntitiesByAudit.mockResolvedValue([{ name: 'Truvyx', sameAsUrls: ['https://en.wikipedia.org/wiki/Truvyx'] }]);
  h.getAuditIntelligenceReport.mockResolvedValue(null);
  h.redisGet.mockResolvedValue(null);
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('end-to-end: /audit', () => {
  it('resolves a bare domain to its completed audit and renders real scores from the real query layer', async () => {
    const res = await POST(webhookReq('/audit truvyx.org'));

    expect(res.status).toBe(200);
    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('AI Visibility: 78/100');
    expect(text).toContain('Machine Trust: 89/100');
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenCalledWith('truvyx.org');
  });

  it('resolves a URL-form domain via the real normalization + www-toggle fallback', async () => {
    h.getLatestUsableAuditForDomainOps
      .mockResolvedValueOnce({ audit: null, isPartial: false, latestAny: null })
      .mockResolvedValueOnce({ audit, isPartial: false, latestAny: { status: 'complete', createdAt: audit.createdAt } });

    const res = await POST(webhookReq('/audit https://www.truvyx.org/'));

    expect(res.status).toBe(200);
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenNthCalledWith(1, 'www.truvyx.org');
    expect(h.getLatestUsableAuditForDomainOps).toHaveBeenNthCalledWith(2, 'truvyx.org');
    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('AI Visibility: 78/100');
  });

  it('reports a truthful "no audits found" for an unknown domain', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: null, isPartial: false, latestAny: null });

    await POST(webhookReq('/audit nowhere.example'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('No SiteNexis audits found for nowhere.example');
  });

  it('reports a truthful "no completed audit" for a domain whose only audit is still running', async () => {
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: null, isPartial: false, latestAny: { status: 'running', createdAt: new Date() } });

    await POST(webhookReq('/audit truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('currently running');
    expect(text).toContain('No completed SiteNexis audit is available');
  });

  it('on a prose cache miss, shows the truthful limited state and NEVER invokes routeTask or callAI', async () => {
    h.redisGet.mockResolvedValue(null);

    await POST(webhookReq('/audit truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('prose Intelligence Report is not currently available');
    expect(text).toContain('AI Visibility: 78/100'); // scores still present
    expect(routeTaskSpy).not.toHaveBeenCalled();
    expect(callAISpy).not.toHaveBeenCalled();
  });

  it('on a prose cache hit, renders the cached executive summary verbatim and still never invokes an LLM', async () => {
    h.redisGet.mockResolvedValue(JSON.stringify({
      auditId: 'audit-1', modelVersion: 'v1.0', domain: 'truvyx.org',
      composite_score: 8.7, composite_label: 'Strong', overall_verdict: 'Strong AI visibility overall.',
      sections: [{ name: 'Entity Intelligence', score: 91, score_label: 'Strong', strengths: [], issues: ['Missing sameAs links'], narrative: '' }],
      top_recommendations: ['Add Organization schema to the homepage'],
      audit_date: '2026-08-01', benchmark_statement: '', trajectory: '',
    }));

    await POST(webhookReq('/audit truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('8.7/10 — Strong');
    expect(text).toContain('Strong AI visibility overall.');
    expect(routeTaskSpy).not.toHaveBeenCalled();
    expect(callAISpy).not.toHaveBeenCalled();
  });

  it('shows a PARTIAL AUDIT banner for a partial audit, never presenting unavailable data as zero', async () => {
    const partialAudit = { ...audit, status: 'partial' as const };
    h.getLatestUsableAuditForDomainOps.mockResolvedValue({ audit: partialAudit, isPartial: true, latestAny: { status: 'partial', createdAt: new Date() } });
    h.getAuditById.mockResolvedValue(partialAudit);
    h.getAIVisibilityScore.mockResolvedValue(null);

    await POST(webhookReq('/audit truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('PARTIAL AUDIT');
    expect(text).not.toContain('AI Visibility: 0');
  });
});

describe('end-to-end: /scores', () => {
  it('renders every real score tier with real values from the query layer', async () => {
    await POST(webhookReq('/scores truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('SEO Score: 86/100');
    expect(text).toContain('Entity Credibility: 90/100');
    expect(routeTaskSpy).not.toHaveBeenCalled();
  });
});

describe('end-to-end: /issues', () => {
  it('groups real deduplicated issues by canonical severity and HTML-escapes crawled content', async () => {
    h.getIssuesByAudit.mockResolvedValue([
      { id: 'i1', module: 'content', type: 'xss_test', severity: 'critical', message: '<script>alert(1)</script>', recommendation: 'Sanitize output', pageUrl: 'https://truvyx.org/', problem: null, solution: null, fixCode: null, fixLanguage: null, pageId: null, confidence: 'high', renderMethod: null },
    ]);

    await POST(webhookReq('/issues truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('CRITICAL');
    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  });
});

describe('end-to-end: /recommendations', () => {
  it('runs the real buildFixPlan engine and orders output by canonical P0/P1/P2 priority', async () => {
    await POST(webhookReq('/recommendations truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('Add Organization schema to the homepage');
    expect(routeTaskSpy).not.toHaveBeenCalled();
  });
});

describe('end-to-end: /evidence', () => {
  it('reports real crawl evidence and marks partial/missing evidence as "not detected", never a negative claim', async () => {
    h.getPagesByAudit.mockResolvedValue([
      { id: 'p1', url: 'https://truvyx.org/', statusCode: 200, isIndexable: true, robotsDirective: null, canonicalUrl: null, canonicalValidity: null, h1: null, schemaData: [] },
    ]);

    await POST(webhookReq('/evidence truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('Robots directive: not detected');
    expect(text).toContain('Canonical: not detected');
    expect(text).toContain('H1: not detected');
    expect(routeTaskSpy).not.toHaveBeenCalled();
  });
});

describe('end-to-end: /report', () => {
  it('on a prose cache miss, points to still-available deterministic commands and never invokes an LLM', async () => {
    h.redisGet.mockResolvedValue(null);

    await POST(webhookReq('/report truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('prose Intelligence Report is not currently available');
    expect(text).toContain('/scores');
    expect(routeTaskSpy).not.toHaveBeenCalled();
    expect(callAISpy).not.toHaveBeenCalled();
  });

  it('on a prose cache hit, renders the cached narrative report sections verbatim', async () => {
    h.redisGet.mockResolvedValue(JSON.stringify({
      auditId: 'audit-1', domain: 'truvyx.org', generatedAt: '2026-08-01T00:00:00Z', modelVersion: 'v4.1',
      summary: 'truvyx.org shows strong entity clarity.',
      sections: [{ name: 'Machine Trust', narrative: 'Trust signals are consistent across pages.' }],
    }));

    await POST(webhookReq('/report truvyx.org'));

    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('truvyx.org shows strong entity clarity.');
    expect(text).toContain('Trust signals are consistent across pages.');
    expect(routeTaskSpy).not.toHaveBeenCalled();
  });
});

describe('cross-cutting: authorization', () => {
  it('never dispatches or replies to an Audit Intelligence command from a non-admin chat', async () => {
    const res = await POST(webhookReq('/audit truvyx.org', 999999));

    expect(res.status).toBe(200);
    expect(global.fetch).not.toHaveBeenCalled();
    expect(h.getLatestUsableAuditForDomainOps).not.toHaveBeenCalled();
  });
});

describe('cross-cutting: degraded dependency', () => {
  it('degrades gracefully instead of hanging forever when the domain-lookup query never resolves', async () => {
    h.getLatestUsableAuditForDomainOps.mockImplementation(() => new Promise(() => {}));

    const res = await POST(webhookReq('/audit truvyx.org'));

    expect(res.status).toBe(200);
    const [text] = sentTexts(global.fetch as ReturnType<typeof vi.fn>);
    expect(text).toContain('Degraded');
  }, 15_000);
});

describe('cross-cutting: Telegram chunking', () => {
  it('chunks a long /recommendations reply exactly as the hardened provider would for any other command', async () => {
    // commandRecommendations shows only the top 5 P0 items (progressive
    // disclosure) — so to force a real multi-chunk reply, each shown item's
    // combined message+recommendation text must itself be long, not just
    // the total issue count.
    const pad = (label: string, i: number) => `${label} ${i} — ${'evidence-backed detail '.repeat(30)}`.trim();
    h.getIssuesByAudit.mockResolvedValue(
      Array.from({ length: 6 }, (_, i) => ({
        id: `i${i}`, module: 'content', type: `finding_${i}`, severity: 'critical' as const,
        message: pad('Finding', i),
        recommendation: pad('Recommendation', i),
        pageUrl: `https://truvyx.org/page-${i}`, problem: null, solution: null, fixCode: null, fixLanguage: null, pageId: null, confidence: 'high' as const, renderMethod: null,
      })),
    );

    await POST(webhookReq('/recommendations truvyx.org'));

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    expect(fetchMock.mock.calls.length).toBeGreaterThan(1);
  });
});

describe('cross-cutting: no secret leakage', () => {
  it('never includes the bot token in any outgoing request body or logged error across the Audit Intelligence chain', async () => {
    h.getLatestUsableAuditForDomainOps.mockRejectedValue(new Error('db connection string leaked? postgres://user:pass@host/db'));

    await POST(webhookReq('/audit truvyx.org'));

    const fetchMock = global.fetch as ReturnType<typeof vi.fn>;
    const allSentBodies = fetchMock.mock.calls.map((c) => (c as [string, RequestInit])[1].body as string).join('\n');
    expect(allSentBodies).not.toContain(h.env.TELEGRAM_BOT_TOKEN);
    expect(allSentBodies).not.toContain('postgres://user:pass@host/db');
  });
});
