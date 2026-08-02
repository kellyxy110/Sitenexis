import { describe, expect, it } from 'vitest';
import {
  createConfidenceSummary,
  evaluateFindingEligibility,
  evaluateRecommendationEligibility,
  type EvidenceProjection,
  type RawRenderedEvidenceComparison,
} from '@sitenexis/shared';

function evidence(overrides: Partial<EvidenceProjection> = {}): EvidenceProjection {
  return {
    id: 'evidence-1', auditId: 'audit-1', domain: 'example.com', scope: 'PAGE', category: 'on-page-seo',
    title: 'Observed H1', description: 'Direct observation.', verificationState: 'CONFIRMED',
    confidence: createConfidenceSummary({ score: 0.9 }), url: 'https://example.com/page', ...overrides,
  };
}

function comparison(overrides: Partial<RawRenderedEvidenceComparison> = {}): RawRenderedEvidenceComparison {
  return {
    field: 'h1', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE', relationship: 'BOTH_MISSING',
    confidence: createConfidenceSummary({ score: 0.9 }), evidenceReferences: [], ...overrides,
  };
}

const audit = { auditId: 'audit-1', domain: 'example.com' };

describe('finding integrity eligibility', () => {
  it('allows a page-specific confirmed conclusion only with current URL-scoped evidence', () => {
    const result = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'PAGE' }, evidence: [evidence()] });
    expect(result).toMatchObject({ eligible: true, maximumVerificationState: 'CONFIRMED', affectedUrls: ['https://example.com/page'] });
  });

  it('blocks page conclusions without an affected URL or supporting evidence', () => {
    const missingUrl = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'PAGE' }, evidence: [evidence({ url: null })] });
    const missingEvidence = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'PAGE' } });
    expect(missingUrl.eligible).toBe(false);
    expect(missingUrl.diagnostics.map((item) => item.code)).toContain('MISSING_AFFECTED_URL');
    expect(missingEvidence.diagnostics.map((item) => item.code)).toContain('MISSING_SUPPORTING_EVIDENCE');
  });

  it('uses raw/rendered availability to block unsupported absence claims', () => {
    const renderedH1 = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'PAGE', claimPolarity: 'ABSENCE', requiredFields: ['h1'] },
      evidence: [evidence({ verificationState: 'NOT_DETECTED' })],
      rawRenderedComparisons: [comparison({ relationship: 'RENDERED_ONLY' })],
    });
    const notAttempted = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'PAGE', intendedVerificationState: 'PARTIAL', claimPolarity: 'ABSENCE', requiredFields: ['h1'] },
      evidence: [evidence({ verificationState: 'NOT_DETECTED' })],
      rawRenderedComparisons: [comparison({ renderedAvailability: 'NOT_ATTEMPTED', relationship: 'NOT_COMPARABLE' })],
    });
    const bothMissing = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'PAGE', claimPolarity: 'ABSENCE', requiredFields: ['h1'] },
      evidence: [evidence({ rawValue: null }), evidence({ id: 'evidence-2', sourceLayer: 'RENDERED_DOM', rawValue: null })],
      rawRenderedComparisons: [comparison()],
    });

    expect(renderedH1.eligible).toBe(false);
    expect(renderedH1.diagnostics.map((item) => item.code)).toContain('RAW_RENDERED_CONFLICT');
    expect(notAttempted.maximumVerificationState).toBe('PARTIAL');
    expect(notAttempted.diagnostics.map((item) => item.code)).toContain('EXTRACTION_NOT_ATTEMPTED');
    expect(bothMissing.eligible).toBe(true);
  });

  it('does not convert unavailable provider or module state into absence evidence', () => {
    const provider = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'EXTERNAL_ENTITY', providerRequirement: 'backlinks' },
      evidence: [evidence({ scope: 'EXTERNAL_ENTITY' })],
      providers: [{ provider: 'backlinks', available: false, configured: false, reasonCode: 'MISSING_CREDENTIAL' }],
    });
    const blocked = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'DOMAIN' }, evidence: [evidence({ scope: 'DOMAIN' })],
      moduleSummary: { moduleId: 'citation-intelligence', state: 'BLOCKED', reasonCode: 'DEPENDENCY_FAILED' },
    });
    const partial = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'DOMAIN', intendedVerificationState: 'PARTIAL', domainEvidenceSufficient: true },
      evidence: [evidence({ scope: 'DOMAIN' })], moduleSummary: { moduleId: 'scout', state: 'PARTIAL', partial: true },
    });

    expect(provider.eligible).toBe(false);
    expect(provider.diagnostics.map((item) => item.code)).toContain('PROVIDER_UNAVAILABLE');
    expect(blocked.diagnostics.map((item) => item.code)).toContain('MODULE_BLOCKED');
    expect(partial).toMatchObject({ eligible: true, maximumVerificationState: 'PARTIAL' });
  });

  it('requires supported page classification before page-type-specific logic', () => {
    const supported = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'PAGE', pageClassificationRequirement: { classification: 'ARTICLE', minimumConfidence: 0.8 } },
      evidence: [evidence()],
      pageClassification: { classification: 'ARTICLE', confidence: createConfidenceSummary({ score: 0.9 }), evidenceIds: ['evidence-1'], verificationState: 'CONFIRMED' },
    });
    const unknown = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'PAGE', pageClassificationRequirement: { classification: 'ARTICLE' } }, evidence: [evidence()],
      pageClassification: { classification: 'UNKNOWN', confidence: createConfidenceSummary(), evidenceIds: [] },
    });

    expect(supported.eligible).toBe(true);
    expect(unknown.eligible).toBe(false);
    expect(unknown.diagnostics.map((item) => item.code)).toContain('PAGE_CLASSIFICATION_UNVERIFIED');
  });

  it('keeps historical evidence separate unless an explicit historical trend context is requested', () => {
    const historical = evidence({ id: 'old-evidence', auditId: 'audit-0' });
    const current = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'PAGE' }, historicalEvidence: [historical] });
    const trend = evaluateFindingEligibility({
      audit,
      candidate: { intendedScope: 'HISTORICAL_TREND', historicalContext: true, intendedVerificationState: 'PARTIAL' },
      historicalEvidence: [historical],
    });

    expect(current.eligible).toBe(false);
    expect(current.diagnostics.map((item) => item.code)).toContain('HISTORICAL_EVIDENCE_ONLY');
    expect(trend.eligible).toBe(true);
    expect(trend.evidenceIds).toEqual(['old-evidence']);
  });

  it('requires rendered visual evidence and explicit domain breadth where applicable', () => {
    const visual = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'VISUAL_RENDER', requiresVisualEvidence: true }, evidence: [evidence()] });
    const screenshot = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'VISUAL_RENDER', requiresVisualEvidence: true }, evidence: [evidence({ sourceLayer: 'SCREENSHOT' })] });
    const domain = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'DOMAIN' }, evidence: [evidence({ scope: 'PAGE' })] });
    const aggregate = evaluateFindingEligibility({ audit, candidate: { intendedScope: 'DOMAIN', domainEvidenceSufficient: true }, evidence: [evidence({ scope: 'DOMAIN' })] });

    expect(visual.eligible).toBe(false);
    expect(visual.diagnostics.map((item) => item.code)).toContain('VISUAL_EVIDENCE_REQUIRED');
    expect(screenshot.eligible).toBe(true);
    expect(domain.eligible).toBe(false);
    expect(domain.maximumVerificationState).toBe('LIKELY');
    expect(aggregate.eligible).toBe(true);
  });

  it('guards recommendation applicability and leaves caller data immutable', () => {
    const input = {
      audit,
      candidate: { intendedScope: 'PAGE' as const, pageClassificationRequirement: { classification: 'ARTICLE' as const }, requiresUnverifiedBusinessFacts: true },
      evidence: [evidence()],
      pageClassification: { classification: 'ARTICLE' as const, confidence: createConfidenceSummary({ score: 0.9 }), evidenceIds: ['evidence-1'] },
    };
    const before = JSON.stringify(input);
    const result = evaluateRecommendationEligibility(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.applicable).toBe(false);
    expect(result.diagnostics.map((item) => item.code)).toContain('RECOMMENDATION_REQUIRES_UNVERIFIED_FACTS');
  });
});