import { describe, expect, it } from 'vitest';
import {
  assembleCanonicalIntelligenceReportV2,
  buildIntelligenceReportV2Delivery,
  calculateScoringV2Categories,
  composeIntelligenceReportV2Input,
  evaluateFindingEligibility,
  projectLegacyAuditEvidence,
  projectScoringV2Input,
  type IntelligenceReportV2Delivery,
  type LegacyIssueEvidenceRecord,
  type LegacyPageEvidenceRecord,
} from '@sitenexis/shared';

/**
 * Mirrors apps/web/src/lib/intelligence-report-v2.ts's composition path, minus
 * the DB read. Exercised here as a pure package-level integration test so the
 * full legacy-audit -> canonical-delivery pipeline is covered without mocking
 * Next.js request/DB plumbing.
 */
function deliverAudit(
  pages: LegacyPageEvidenceRecord[],
  issues: LegacyIssueEvidenceRecord[],
  auditId = 'audit-1',
  domain = 'example.com',
): IntelligenceReportV2Delivery {
  const evidence = projectLegacyAuditEvidence({ pages, issues }, { domain });
  const composed = composeIntelligenceReportV2Input({ audit: { auditId, domain }, evidence });
  const eligibilityByIssueId = Object.fromEntries(issues.map((issue) => [
    issue.id,
    evaluateFindingEligibility({
      audit: composed.input.audit,
      candidate: {
        intendedScope: issue.pageId || issue.pageUrl ? 'PAGE' : 'DOMAIN',
        intendedVerificationState: 'CONFIRMED',
        evidenceIds: [`legacy:issue:${issue.id}`],
        affectedUrls: issue.pageUrl ? [issue.pageUrl] : undefined,
      },
      evidence: composed.input.evidence,
    }),
  ]));
  const assembled = assembleCanonicalIntelligenceReportV2({ input: composed.input, findingProjection: { legacyIssues: issues, eligibilityByIssueId } });
  const calculation = calculateScoringV2Categories(projectScoringV2Input(assembled.report));
  return buildIntelligenceReportV2Delivery(assembled.report, calculation);
}

const healthyPage: LegacyPageEvidenceRecord = {
  id: 'page-1',
  auditId: 'audit-1',
  url: 'https://example.com/about',
  finalUrl: 'https://example.com/about',
  statusCode: 200,
  title: 'About Example',
  metaDescription: 'Learn about Example.',
  h1: 'About us',
  h2: ['Our history', 'Our team'],
  rawCanonical: '/about',
  resolvedCanonical: 'https://example.com/about',
  canonicalCount: 1,
  canonicalSource: 'raw-dom',
  canonicalValidity: 'valid',
  isSelfReferencing: true,
  contentHash: 'hash-1',
  extractionMode: 'static-html',
  extractionConfidence: 0.92,
  crawledAt: new Date('2026-08-02T00:00:00.000Z'),
};

describe('Intelligence Report v2 delivery regression', () => {
  it('projects a healthy legacy stored page into a measured category score instead of INSUFFICIENT_EVIDENCE', () => {
    const delivery = deliverAudit([healthyPage], []);
    const technical = delivery.report.scores.find((s) => s.category === 'Technical SEO');
    const onPage = delivery.report.scores.find((s) => s.category === 'On-Page SEO');
    expect(technical?.state).toBe('CALCULATED');
    expect(typeof technical?.score).toBe('number');
    expect(onPage?.state).toBe('CALCULATED');
    expect(typeof onPage?.score).toBe('number');
  });

  it('never claims H1 missing when raw extraction found nothing but rendering was never attempted', () => {
    const csrPage: LegacyPageEvidenceRecord = { ...healthyPage, id: 'page-csr', h1: null, extractionMode: 'static-html' };
    const delivery = deliverAudit([csrPage], []);
    const onPage = delivery.report.scores.find((s) => s.category === 'On-Page SEO');
    const trace = onPage?.metadata?.trace as { signalTraces?: Array<{ signalId: string }>; directNegativeDeduction?: number };
    expect((trace.signalTraces ?? []).some((t: { signalId: string }) => t.signalId.includes('H1_MISSING'))).toBe(false);
  });

  it('confirms H1 missing only once rendered-DOM extraction actually completed and still found nothing', () => {
    const renderedNoH1: LegacyPageEvidenceRecord = { ...healthyPage, id: 'page-rendered', h1: null, extractionMode: 'headless-rendered', extractionConfidence: 0.9 };
    const delivery = deliverAudit([renderedNoH1], []);
    const onPage = delivery.report.scores.find((s) => s.category === 'On-Page SEO');
    const trace = onPage?.metadata?.trace as { signalTraces?: Array<{ signalId: string }>; directNegativeDeduction?: number };
    expect(trace.directNegativeDeduction).toBeGreaterThan(0);
    expect((trace.signalTraces ?? []).some((t: { signalId: string }) => t.signalId.includes('H1_MISSING'))).toBe(true);
  });

  it('does not fabricate a score effect for unmappable legacy issue evidence', () => {
    const issue: LegacyIssueEvidenceRecord = {
      id: 'issue-thin', auditId: 'audit-1', pageId: healthyPage.id, pageUrl: healthyPage.url!,
      module: 'content', type: 'thin_content', severity: 'medium', message: 'Thin content', recommendation: 'Expand content.',
    };
    const withUnmappable = deliverAudit([healthyPage], [issue]);
    const baseline = deliverAudit([healthyPage], []);
    const withScore = withUnmappable.report.scores.find((s) => s.category === 'Content Depth and Information Gain');
    expect(withScore?.state).not.toBe('CALCULATED');
    expect(withUnmappable.overall.overallScore).toBe(baseline.overall.overallScore);
  });

  it('does not report a confirmed defect for a crawl-failed or not-yet-attempted extraction', () => {
    const issue: LegacyIssueEvidenceRecord = {
      id: 'issue-crawl-failed', auditId: 'audit-1', module: 'crawler', type: 'crawl_failed',
      severity: 'critical', message: 'Crawl failed', recommendation: 'Retry the crawl.',
    };
    const delivery = deliverAudit([healthyPage], [issue]);
    expect(delivery.recommendations.every((rec) => rec.verificationState === 'CONFIRMED')).toBe(true);
    expect(delivery.recommendations.some((rec) => rec.rootCauseIds.includes('crawl_failed'))).toBe(false);
  });

  it('never lets an unavailable citation/backlink provider read as zero — category becomes UNAVAILABLE, not a deducted score', () => {
    const evidence = projectLegacyAuditEvidence({ pages: [healthyPage], issues: [] }, { domain: 'example.com' });
    const composed = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com' },
      evidence,
      providers: [{ provider: 'backlinks', available: false, reason: 'Provider not configured for this plan.' }],
    });
    const assembled = assembleCanonicalIntelligenceReportV2({ input: composed.input, findingProjection: { legacyIssues: [], eligibilityByIssueId: {} } });
    const calculation = calculateScoringV2Categories(projectScoringV2Input(assembled.report));
    const delivery = buildIntelligenceReportV2Delivery(assembled.report, calculation);
    const citation = delivery.report.scores.find((s) => s.category === 'Citation Authority');
    expect(citation?.state).toBe('UNAVAILABLE');
    expect(citation?.score).toBeUndefined();
  });

  it('recommendations remain evidence-backed: every recommendation cites at least one evidence id', () => {
    const issue: LegacyIssueEvidenceRecord = {
      id: 'issue-canonical', auditId: 'audit-1', pageId: healthyPage.id, pageUrl: healthyPage.url!,
      module: 'seo', type: 'duplicate_canonical', severity: 'high', message: 'Canonical mismatch', recommendation: 'Fix canonical.',
    };
    const delivery = deliverAudit([healthyPage], [issue]);
    expect(delivery.recommendations.every((rec) => rec.evidenceIds.length > 0)).toBe(true);
  });

  it('keeps unavailable/insufficient categories as null scores, never zero', () => {
    const delivery = deliverAudit([], []);
    for (const score of delivery.report.scores) {
      if (score.state !== 'CALCULATED') expect(score.score).toBeUndefined();
    }
  });

  it('excludes unavailable/not-applicable weight from the overall score numerator and denominator', () => {
    const delivery = deliverAudit([healthyPage], []);
    const measuredCategories = delivery.report.scores.filter((s) => s.state === 'CALCULATED');
    const expectedDenominator = measuredCategories.reduce((sum, s) => sum + (s.weight ?? 0), 0);
    expect(delivery.overall.scoreTrace.denominator).toBe(expectedDenominator);
    expect(delivery.overall.measuredWeight).toBe(expectedDenominator);
  });

  it('the full per-category scoring trace survives delivery intact', () => {
    const delivery = deliverAudit([healthyPage], []);
    const technical = delivery.report.scores.find((s) => s.category === 'Technical SEO');
    const trace = technical?.metadata?.trace;
    expect(trace).toMatchObject({
      baseline: 50,
      preClampScore: expect.any(Number),
      finalScore: expect.any(Number),
      usedSignalIds: expect.any(Array),
      signalTraces: expect.any(Array),
    });
  });

  it('is deterministic across repeated runs on the same input', () => {
    const first = deliverAudit([healthyPage], []);
    const second = deliverAudit([healthyPage], []);
    expect(first).toEqual(second);
  });

  it('does not mutate the supplied legacy page/issue records', () => {
    const page = { ...healthyPage };
    const issue: LegacyIssueEvidenceRecord = {
      id: 'issue-x', auditId: 'audit-1', pageId: page.id, pageUrl: page.url!,
      module: 'seo', type: 'missing_h1', severity: 'high', message: 'x', recommendation: 'y',
    };
    const pageBefore = JSON.stringify(page);
    const issueBefore = JSON.stringify(issue);
    deliverAudit([page], [issue]);
    expect(JSON.stringify(page)).toBe(pageBefore);
    expect(JSON.stringify(issue)).toBe(issueBefore);
  });
});
