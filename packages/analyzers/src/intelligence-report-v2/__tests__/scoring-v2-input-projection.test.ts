import { describe, expect, it } from 'vitest';
import {
  createConfidenceSummary,
  projectScoringV2Input,
  type CanonicalIntelligenceReportV2,
  type EvidenceProjection,
} from '@sitenexis/shared';

function report(): CanonicalIntelligenceReportV2 {
  return {
    identity: { reportId: 'r', auditId: 'a', domain: 'example.com', reportVersion: 'v2', evidenceModelVersion: 'v2', scoringModelVersion: 'v2', crawlerVersion: 'v2' },
    methodology: { scoringModelVersion: 'v2', reportVersion: 'v2', evidenceModelVersion: 'v2', crawlerVersion: 'v2' },
    audit: { classification: 'CURRENT' },
    confidence: createConfidenceSummary(),
    moduleStatus: [],
    providers: [],
    evidence: [],
    rawRenderedComparisons: [],
    findings: [],
    contradictions: [],
    rootCauses: [],
    scores: [],
    legacyScores: { health: 72 },
    recommendations: [],
    opportunities: [],
    limitations: [],
    historical: { available: false, comparable: false, sourceAuditIds: [], evidence: [] },
    metadata: { inputValidation: { valid: true, warnings: [], errors: [] }, warnings: [] },
    state: 'READY',
  };
}

/** Realistic legacy page evidence, matching what legacy-evidence-projection.ts actually emits. */
function pageEvidence(overrides: Partial<EvidenceProjection> = {}): EvidenceProjection {
  return {
    id: 'legacy:page:p1:http-status',
    auditId: 'a',
    domain: 'example.com',
    scope: 'PAGE',
    category: 'web-health',
    title: 'HTTP status',
    description: 'Observed HTTP status for this page.',
    issueCode: 'http-status',
    rawValue: 200,
    url: 'https://example.com/p',
    confidence: createConfidenceSummary({ score: 0.9 }),
    verificationState: 'CONFIRMED',
    ...overrides,
  };
}

describe('scoring v2 input projection', () => {
  it('maps a realistic healthy legacy page into measured Technical SEO signals, plus a conflict and an unavailable provider', () => {
    const r = report();
    r.evidence = [
      pageEvidence(),
      pageEvidence({ id: 'legacy:page:p1:canonical', issueCode: 'canonical', category: 'technical-seo', rawValue: '/p', normalizedValue: 'https://example.com/p' }),
    ];
    r.contradictions = [{
      id: 'canonical-conflict', type: 'CANONICAL_CONFLICT', subject: 'page.canonical', scope: 'PAGE', severity: 'high',
      confidence: createConfidenceSummary({ score: 0.8 }), evidenceIds: ['legacy:page:p1:canonical'], values: [],
      affectedUrls: ['https://example.com/p'], modules: [], reason: 'x', resolutionStatus: 'UNRESOLVED',
    }];
    r.providers = [{ provider: 'backlinks', available: false }];

    const p = projectScoringV2Input(r);
    const technical = p.categories.find((x) => x.category === 'Technical SEO');

    // http-status (healthy 200 + https URL) yields two positive signals; canonical yields a third.
    expect(technical?.positiveSignals.map((s) => s.type).sort()).toEqual(['CANONICAL_CONFIRMED', 'HEALTHY_STATUS_CONFIRMED', 'HTTPS_CONFIRMED']);
    expect(technical?.negativeSignals).toHaveLength(1);
    expect(technical?.negativeSignals[0]?.type).toBe('CANONICAL_CONFLICT');
    expect(p.categories.find((x) => x.category === 'Citation Authority')?.unavailableSignals[0]?.polarity).toBe('UNAVAILABLE');
    expect(p.legacyScores).toEqual({ health: 72 });
  });

  it('is deterministic and does not mutate the report', () => {
    const r = report();
    r.evidence = [pageEvidence()];
    const before = JSON.stringify(r);
    expect(projectScoringV2Input(r)).toEqual(projectScoringV2Input(r));
    expect(JSON.stringify(r)).toBe(before);
  });

  it.each([
    ['http-status', 200, 'HEALTHY_STATUS_CONFIRMED'],
    ['title', 'About Example', 'TITLE_CONFIRMED'],
    ['meta-description', 'Learn about Example.', 'META_DESCRIPTION_CONFIRMED'],
    ['h1', 'About us', 'H1_CONFIRMED'],
    ['h2', ['Our history'], 'H2_CONFIRMED'],
    ['canonical', 'https://example.com/p', 'CANONICAL_CONFIRMED'],
  ] as const)('maps legacy issueCode "%s" with a real value to %s', (code, value, expectedType) => {
    const r = report();
    r.evidence = [pageEvidence({ id: `legacy:page:p1:${code}`, issueCode: code, rawValue: value as never })];
    const category = projectScoringV2Input(r).categories.flatMap((c) => c.positiveSignals);
    expect(category.map((s) => s.type)).toContain(expectedType);
  });

  it('never fabricates HEALTHY_STATUS_CONFIRMED for an unhealthy status code', () => {
    const r = report();
    r.evidence = [pageEvidence({ rawValue: 404 })];
    const signals = projectScoringV2Input(r).categories.flatMap((c) => [...c.positiveSignals, ...c.negativeSignals]);
    expect(signals.some((s) => s.type === 'HEALTHY_STATUS_CONFIRMED')).toBe(false);
  });

  it('never fabricates H1_MISSING for a raw-only page with no rendered evidence (CSR/JS-shell protection)', () => {
    const r = report();
    r.evidence = [pageEvidence({
      id: 'legacy:page:p1:h1', issueCode: 'h1', rawValue: null,
      sourceLayer: 'RAW_HTML', confidence: createConfidenceSummary({ score: 0.9 }),
    })];
    const signals = projectScoringV2Input(r).categories.flatMap((c) => [...c.positiveSignals, ...c.negativeSignals]);
    expect(signals.some((s) => s.type.startsWith('H1'))).toBe(false);
  });

  it('confirms H1_MISSING only when rendered-DOM extraction actually completed with usable confidence', () => {
    const r = report();
    r.evidence = [pageEvidence({
      id: 'legacy:page:p1:h1', issueCode: 'h1', rawValue: null,
      sourceLayer: 'RENDERED_DOM', confidence: createConfidenceSummary({ score: 0.9 }),
    })];
    const negatives = projectScoringV2Input(r).categories.flatMap((c) => c.negativeSignals);
    expect(negatives.map((s) => s.type)).toContain('H1_MISSING');
  });

  it('leaves unrecognized legacy evidence codes unmapped with a diagnostic instead of fabricating a category', () => {
    const r = report();
    r.evidence = [pageEvidence({ id: 'legacy:issue:x', issueCode: 'thin_content', category: 'content', rawValue: 'x' })];
    const p = projectScoringV2Input(r);
    expect(p.categories.every((c) => c.positiveSignals.length === 0 && c.negativeSignals.length === 0)).toBe(true);
    expect(p.legacyMappingDiagnostics.some((d) => d.code === 'UNRECOGNIZED_EVIDENCE_CODE')).toBe(true);
  });

  it('never treats CRAWL_FAILED or TEMPORARY_FAILURE evidence as a confirmed signal', () => {
    const r = report();
    r.evidence = [
      pageEvidence({ id: 'legacy:issue:crawl', issueCode: 'title', rawValue: 'Example', verificationState: 'CRAWL_FAILED' }),
      pageEvidence({ id: 'legacy:issue:retry', issueCode: 'title', rawValue: 'Example', verificationState: 'TEMPORARY_FAILURE' }),
    ];
    const p = projectScoringV2Input(r);
    expect(p.categories.every((c) => c.positiveSignals.length === 0)).toBe(true);
    expect(p.legacyMappingDiagnostics.every((d) => d.code === 'VERIFICATION_STATE_TOO_WEAK')).toBe(true);
  });
});
