import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
  checkDatabase: vi.fn(), checkRedis: vi.fn(), checkBullMQQueue: vi.fn(), checkWorkerHeartbeat: vi.fn(),
  deriveModuleAndProviderState: vi.fn(),
  env: { NEXT_PUBLIC_APP_URL: 'https://sitenexis.com' },
  resolveAuditForDomain: vi.fn(),
  getAuditScorecard: vi.fn(),
  getExecutiveSummary: vi.fn(),
  getNarrativeReport: vi.fn(),
  getAuditIssueSummary: vi.fn(),
  getAuditFixPlan: vi.fn(),
  getAuditEvidenceSummary: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({ logger: h.logger }));
vi.mock('@/lib/health-checks', () => ({
  checkDatabase: h.checkDatabase, checkRedis: h.checkRedis, checkBullMQQueue: h.checkBullMQQueue, checkWorkerHeartbeat: h.checkWorkerHeartbeat,
}));
vi.mock('@/lib/intelligence-report-v2-modules', () => ({ deriveModuleAndProviderState: h.deriveModuleAndProviderState }));
vi.mock('@sitenexis/db', () => ({}));
vi.mock('@/lib/env', () => ({ env: h.env }));
vi.mock('@/lib/audit-intelligence/domain-lookup', () => ({ resolveAuditForDomain: h.resolveAuditForDomain }));
vi.mock('@/lib/audit-intelligence/scorecard', () => ({ getAuditScorecard: h.getAuditScorecard }));
vi.mock('@/lib/audit-intelligence/executive-summary-service', () => ({ getExecutiveSummary: h.getExecutiveSummary }));
vi.mock('@/lib/audit-intelligence/narrative-report-service', () => ({ getNarrativeReport: h.getNarrativeReport }));
vi.mock('@/lib/audit-intelligence/issues', () => ({ getAuditIssueSummary: h.getAuditIssueSummary }));
vi.mock('@/lib/audit-intelligence/recommendations', () => ({ getAuditFixPlan: h.getAuditFixPlan }));
vi.mock('@/lib/audit-intelligence/evidence', () => ({ getAuditEvidenceSummary: h.getAuditEvidenceSummary }));

const {
  commandAudit, commandScores, commandIssues, commandRecommendations, commandEvidence, commandReport,
} = await import('../audit-commands');

const resolved = (overrides: Partial<Record<string, unknown>> = {}) => ({
  domain: 'truvyx.org',
  audit: { id: 'audit-1', domain: 'truvyx.org', status: 'complete' as const, createdAt: new Date(), completedAt: new Date() },
  isPartial: false,
  latestAnyStatus: 'complete' as const,
  hadAnyAuditHistory: true,
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe('/audit', () => {
  it('reports a usage message when no domain is supplied', async () => {
    const text = await commandAudit([]);
    expect(text).toContain('Usage: /audit');
    expect(h.resolveAuditForDomain).not.toHaveBeenCalled();
  });

  it('reports no audits found for a domain with no history', async () => {
    h.resolveAuditForDomain.mockResolvedValue({ domain: 'nowhere.example', audit: null, isPartial: false, latestAnyStatus: null, hadAnyAuditHistory: false });

    const text = await commandAudit(['nowhere.example']);

    expect(text).toContain('No SiteNexis audits found for nowhere.example');
  });

  it('reports a truthful "still running" state instead of presenting a running audit as complete', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved({ audit: null, latestAnyStatus: 'running', hadAnyAuditHistory: true }));

    const text = await commandAudit(['truvyx.org']);

    expect(text).toContain('currently running');
    expect(text).toContain('No completed SiteNexis audit is available');
  });

  it('reports a failed-audit state distinctly from "no history"', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved({ audit: null, latestAnyStatus: 'failed', hadAnyAuditHistory: true }));

    const text = await commandAudit(['truvyx.org']);

    expect(text).toContain('most recent SiteNexis audit for truvyx.org failed');
  });

  it('renders scores, executive assessment, and priority for a complete audit with a canonical scorecard and summary', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditScorecard.mockResolvedValue({
      auditId: 'audit-1', domain: 'truvyx.org', status: 'complete',
      v1: { overall: 80, seoScore: 86, aiScore: 70, schemaScore: 90, linkGraphScore: 75, performanceScore: 65 },
      v2: { aiVisibilityScore: 78, machineReadabilityScore: 82, entityConfidenceScore: 91, retrievalReadinessScore: 88, citationProbabilityScore: 92, semanticTrustScore: 95, recommendationConfidence: 70 },
      machineTrust: { overall: 89, entityCredibilityScore: 90, schemaTrustAlignmentScore: 88, externalValidationScore: 85, contradictionAbsenceScore: 95 },
      sii: null,
      scoringModelLabel: 'V1 Technical SEO + V2 AI Visibility + Layer 4 Machine Trust',
    });
    h.getExecutiveSummary.mockResolvedValue({
      state: 'complete',
      data: {
        auditId: 'audit-1', modelVersion: 'v1.0', domain: 'truvyx.org',
        audit_date: '2026-08-01', overall_verdict: 'Strong AI visibility with a few structural gaps.',
        composite_score: 8.7, composite_label: 'Strong',
        sections: [{ name: 'Entity Intelligence', score: 91, score_label: 'Strong', strengths: [], issues: ['Missing sameAs links'], narrative: '' }],
        top_recommendations: ['Add Organization schema to the homepage'],
        benchmark_statement: '', trajectory: '',
      },
    });

    const text = await commandAudit(['truvyx.org']);

    expect(text).toContain('8.7/10 — Strong');
    expect(text).toContain('AI Visibility: 78/100');
    expect(text).toContain('Machine Trust: 89/100');
    expect(text).toContain('Strong AI visibility with a few structural gaps.');
    expect(text).toContain('Entity Intelligence: Missing sameAs links');
    expect(text).toContain('Add Organization schema to the homepage');
    expect(text).toContain('https://sitenexis.com/audit/truvyx.org');
  });

  it('shows a PARTIAL AUDIT banner and never presents unavailable scores as zero', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved({ isPartial: true, audit: { id: 'audit-1', domain: 'truvyx.org', status: 'partial', createdAt: new Date(), completedAt: null } }));
    h.getAuditScorecard.mockResolvedValue({
      auditId: 'audit-1', domain: 'truvyx.org', status: 'partial',
      v1: { overall: 80, seoScore: 86, aiScore: 70, schemaScore: 90, linkGraphScore: 75, performanceScore: 65 },
      v2: null, machineTrust: null, sii: null,
      scoringModelLabel: 'V1 Technical SEO',
    });
    h.getExecutiveSummary.mockResolvedValue(null);

    const text = await commandAudit(['truvyx.org']);

    expect(text).toContain('PARTIAL AUDIT');
    expect(text).not.toContain('AI Visibility: 0');
    expect(text).toContain('prose Intelligence Report is not currently available');
  });

  it('degrades gracefully instead of throwing when the scorecard lookup fails', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditScorecard.mockRejectedValue(new Error('db unreachable'));
    h.getExecutiveSummary.mockResolvedValue(null);

    const text = await commandAudit(['truvyx.org']);

    expect(text).toContain('Degraded');
    expect(text).not.toContain('db unreachable');
  });
});

describe('/scores', () => {
  it('lists every score tier that exists and marks missing tiers as unavailable, never zero', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditScorecard.mockResolvedValue({
      auditId: 'audit-1', domain: 'truvyx.org', status: 'complete',
      v1: { overall: 80, seoScore: 86, aiScore: 70, schemaScore: 90, linkGraphScore: 75, performanceScore: 65 },
      v2: null, machineTrust: null, sii: { score: 72, confidence: 0.8 },
      scoringModelLabel: 'V1 Technical SEO + SII composite',
    });

    const text = await commandScores(['truvyx.org']);

    expect(text).toContain('SEO Score: 86/100');
    expect(text).toContain('V2 — AI Visibility');
    expect(text).toContain('unavailable');
    expect(text).toContain('SII — Composite Index');
    expect(text).toContain('Confidence: 80/100');
  });
});

describe('/issues', () => {
  it('groups issues by canonical severity (critical/warning/info), never invented labels', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditIssueSummary.mockResolvedValue({
      domain: 'truvyx.org', totalRawIssues: 3,
      critical: [{ module: 'schema', severity: 'critical', message: 'Missing Organization schema', affectedPageCount: 1 }],
      warning: [], info: [],
    });

    const text = await commandIssues(['truvyx.org']);

    expect(text).toContain('CRITICAL');
    expect(text).toContain('Missing Organization schema');
    expect(text).toContain('<b>WARNING</b>\nNone');
  });

  it('HTML-escapes issue text sourced from crawled content', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditIssueSummary.mockResolvedValue({
      domain: 'truvyx.org', totalRawIssues: 1,
      critical: [{ module: 'content', severity: 'critical', message: '<script>alert(1)</script>', affectedPageCount: 1 }],
      warning: [], info: [],
    });

    const text = await commandIssues(['truvyx.org']);

    expect(text).not.toContain('<script>');
    expect(text).toContain('&lt;script&gt;');
  });
});

describe('/recommendations', () => {
  it('orders recommendations by canonical P0/P1/P2 priority', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditFixPlan.mockResolvedValue({
      state: 'complete', timestamp: new Date().toISOString(), domain: 'truvyx.org',
      totalItems: 1, p0Count: 1, p1Count: 0, p2Count: 0, overallFixScore: 74, estimatedTotalEffortHours: 2,
      items: [{ id: 'i1', priority: 'P0', module: 'schema', type: 'missing_org_schema', severity: 'critical', pageUrl: null, message: 'No Organization schema', recommendation: 'Add Organization schema to the homepage', problem: null, solution: null, fixCode: null, fixLanguage: null, expectedImpact: 10, effort: 'low', dependsOn: [], impactScores: { seoImpact: 5, aiVisibilityImpact: 5, trustImpact: 5 } }],
      dependencyChains: [], moduleBreakdown: [],
    });

    const text = await commandRecommendations(['truvyx.org']);

    expect(text).toContain('P0 — Immediate');
    expect(text).toContain('Add Organization schema to the homepage');
  });

  it('reports no outstanding recommendations truthfully when the fix plan is empty', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditFixPlan.mockResolvedValue({
      state: 'empty', timestamp: new Date().toISOString(), domain: 'truvyx.org',
      totalItems: 0, p0Count: 0, p1Count: 0, p2Count: 0, overallFixScore: 100, estimatedTotalEffortHours: 0,
      items: [], dependencyChains: [], moduleBreakdown: [],
    });

    const text = await commandRecommendations(['truvyx.org']);

    expect(text).toContain('No outstanding recommendations');
  });
});

describe('/evidence', () => {
  it('reports available evidence and marks missing fields as "not detected", never negative evidence', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getAuditEvidenceSummary.mockResolvedValue({
      domain: 'truvyx.org', pageCount: 12,
      homepage: { url: 'https://truvyx.org/', statusCode: 200, isIndexable: true, robotsDirective: null, canonicalUrl: 'https://truvyx.org/', canonicalValidity: 'valid', h1: 'Welcome', schemaTypesDetected: ['Organization'] },
      indexability: { indexablePages: 12, nonIndexablePages: 0 },
      schemaCoverage: { pagesWithSchema: 8, pagesWithoutSchema: 4, distinctSchemaTypes: ['Organization', 'Article'] },
      canonicalIssues: { missingCanonical: 1, invalidCanonical: 0 },
      entities: { count: 1, primaryEntityName: 'Truvyx', sameAsLinksCount: 2 },
    });

    const text = await commandEvidence(['truvyx.org']);

    expect(text).toContain('Robots directive: not detected');
    expect(text).toContain('Canonical: https://truvyx.org/');
    expect(text).toContain('Types detected: Organization, Article');
    expect(text).toContain('Primary entity: Truvyx');
  });
});

describe('/report', () => {
  it('reports the report as unavailable rather than regenerating with a different LLM call, and points to still-available deterministic commands', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getNarrativeReport.mockResolvedValue({ state: 'complete', data: null });

    const text = await commandReport(['truvyx.org']);

    expect(text).toContain('prose Intelligence Report is not currently available');
    expect(text).toContain('/scores');
    expect(text).toContain('/recommendations');
  });

  it('renders section narratives from the canonical narrative report and points to the dashboard for the full version', async () => {
    h.resolveAuditForDomain.mockResolvedValue(resolved());
    h.getNarrativeReport.mockResolvedValue({
      state: 'complete',
      data: {
        auditId: 'audit-1', domain: 'truvyx.org', generatedAt: new Date().toISOString(), modelVersion: 'v4.1',
        summary: 'truvyx.org shows strong entity clarity.',
        sections: [{ name: 'Machine Trust', narrative: 'Trust signals are consistent across pages.' }],
      },
    });

    const text = await commandReport(['truvyx.org']);

    expect(text).toContain('truvyx.org shows strong entity clarity.');
    expect(text).toContain('Machine Trust');
    expect(text).toContain('Trust signals are consistent across pages.');
    expect(text).toContain('executive excerpt');
    expect(text).toContain('https://sitenexis.com/audit/truvyx.org');
  });
});
