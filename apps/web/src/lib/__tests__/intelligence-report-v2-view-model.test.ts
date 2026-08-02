import { describe, expect, it } from 'vitest';
import { createConfidenceSummary, type CanonicalScorePlaceholder, type ScoringV2CategoryTrace } from '@sitenexis/shared';
import {
  buildCategoryExplanation,
  categoryStatusLabel,
  confidenceLabelFor,
  diagnosticLabel,
  isLikelyIntelligenceReportV2Delivery,
  isScoringV2CategoryTrace,
  verificationStateLabel,
} from '../intelligence-report-v2-view-model';

function trace(overrides: Partial<ScoringV2CategoryTrace> = {}): ScoringV2CategoryTrace {
  return {
    baseline: 50, positiveContribution: 14, rawNegativeDeduction: 0, directNegativeDeduction: 0,
    groupedSymptomRawDeduction: 0, groupedSymptomAppliedDeduction: 0, groupedSymptomSuppression: 0,
    rootCausePrimaryRawDeduction: 0, rootCausePrimaryAppliedDeduction: 0,
    rootCauseSecondaryRawDeduction: 0, rootCauseSecondaryAppliedDeduction: 0,
    rootCauseCategoryCapSuppression: 0, rootCauseGlobalCapSuppression: 0,
    deduplicatedNegativeDeduction: 0, preClampScore: 64, finalScore: 64,
    usedSignalIds: ['s1'], ignoredSignalIds: [], unmappedSignalIds: [], suppressedSignalIds: [],
    rootCauseIds: [], contradictionIds: [], evidenceIds: ['e1'], limitations: [], diagnostics: [],
    eligibleSignalCount: 1, categoryDefiningSignalIds: [], unavailableSignalCount: 0, unmappedSignalCount: 0,
    signalTraces: [], rootCauseTraces: [],
    ...overrides,
  };
}

function score(overrides: Partial<CanonicalScorePlaceholder> & { omitScore?: boolean } = {}): CanonicalScorePlaceholder {
  const { omitScore, ...rest } = overrides;
  const base: CanonicalScorePlaceholder = {
    category: 'Technical SEO', state: 'CALCULATED', score: 64, weight: 6,
    confidence: createConfidenceSummary({ score: 0.9 }), coverage: 0.9,
    positiveContributors: ['s1'], negativeContributors: [], rootCauseIds: [], contradictionIds: [], evidenceIds: ['e1'],
    metadata: { status: 'CALCULATED', diagnostics: '', trace: trace() },
    ...rest,
  };
  if (omitScore) delete base.score;
  return base;
}

describe('isScoringV2CategoryTrace', () => {
  it('accepts a real trace object', () => {
    expect(isScoringV2CategoryTrace(trace())).toBe(true);
  });
  it('rejects a stringified trace (guards the old double-encoded shape)', () => {
    expect(isScoringV2CategoryTrace(JSON.stringify(trace()))).toBe(false);
  });
  it('rejects null, undefined, and arbitrary objects', () => {
    expect(isScoringV2CategoryTrace(null)).toBe(false);
    expect(isScoringV2CategoryTrace(undefined)).toBe(false);
    expect(isScoringV2CategoryTrace({ foo: 'bar' })).toBe(false);
  });
});

describe('buildCategoryExplanation', () => {
  const report = {
    evidence: [{ id: 'e1', auditId: 'a', domain: 'example.com', scope: 'PAGE' as const, category: 'technical-seo', title: 't', description: 'd', confidence: createConfidenceSummary(), verificationState: 'CONFIRMED' as const, url: 'https://example.com/p' }],
    contradictions: [],
    rootCauses: [],
  };

  it('never coerces a null/undefined score to 0, and surfaces the fine-grained status (not the coarse NOT_CALCULATED rollup)', () => {
    const explanation = buildCategoryExplanation(score({ state: 'NOT_CALCULATED', omitScore: true, metadata: { status: 'INSUFFICIENT_EVIDENCE', diagnostics: '', trace: trace({ finalScore: null, preClampScore: null }) } }), report);
    expect(explanation.score).toBeNull();
    expect(explanation.status).toBe('INSUFFICIENT_EVIDENCE');
    expect(explanation.statusLabel).toBe('Insufficient evidence to score');
  });

  it('exposes baseline, adjustments, pre-clamp, and final score directly from the trace', () => {
    const t = trace({
      positiveContribution: 14, directNegativeDeduction: 5, groupedSymptomAppliedDeduction: 2, groupedSymptomSuppression: 6,
      rootCausePrimaryAppliedDeduction: 10, rootCauseSecondaryAppliedDeduction: 3,
      rootCauseCategoryCapSuppression: 1, rootCauseGlobalCapSuppression: 4, preClampScore: 44, finalScore: 44,
    });
    const explanation = buildCategoryExplanation(score({ metadata: { status: 'CALCULATED', diagnostics: '', trace: t } }), report);
    expect(explanation.baseline).toBe(50);
    expect(explanation.preClampScore).toBe(44);
    expect(explanation.finalScore).toBe(44);
    const labels = explanation.adjustments.map((a) => a.label);
    expect(labels).toEqual([
      'Positive contribution', 'Direct deductions', 'Grouped-symptom effects',
      'Primary root-cause deduction', 'Secondary root-cause deduction (from a root cause primarily affecting another category)',
      'Per-category cap suppression', 'Global cap suppression',
    ]);
    expect(explanation.adjustments.find((a) => a.label === 'Direct deductions')?.amount).toBe(-5);
    expect(explanation.adjustments.find((a) => a.label === 'Positive contribution')?.amount).toBe(14);
  });

  it('resolves supporting evidence, contradictions, and root causes by id, and derives affected URLs from evidence', () => {
    const explanation = buildCategoryExplanation(score(), report);
    expect(explanation.supportingEvidence).toHaveLength(1);
    expect(explanation.affectedUrls).toEqual(['https://example.com/p']);
  });

  it('omits zero-magnitude adjustment lines instead of showing empty rows', () => {
    const explanation = buildCategoryExplanation(score({ metadata: { status: 'CALCULATED', diagnostics: '', trace: trace({ positiveContribution: 14, directNegativeDeduction: 0 }) } }), report);
    expect(explanation.adjustments).toHaveLength(1);
  });

  it('degrades gracefully when the trace is malformed or missing, without throwing', () => {
    const explanation = buildCategoryExplanation(score({ metadata: { status: 'CALCULATED', diagnostics: '', trace: 'not-a-trace' } }), report);
    expect(explanation.traceAvailable).toBe(false);
    expect(explanation.adjustments).toEqual([]);
    expect(explanation.finalScore).toBe(64); // falls back to score.score
  });

  it('translates diagnostic codes to human-readable text', () => {
    const explanation = buildCategoryExplanation(score({ metadata: { status: 'CALCULATED', diagnostics: '', trace: trace({ diagnostics: ['UNMAPPED_SCORING_SIGNAL', 'SOME_UNKNOWN_CODE'] }) } }), report);
    expect(explanation.diagnostics[0]).toBe('Some evidence could not be matched to a known scoring signal and was excluded.');
    expect(explanation.diagnostics[1]).toBe('Some unknown code');
  });
});

describe('label helpers', () => {
  it('verificationStateLabel returns a human sentence, not the raw enum', () => {
    expect(verificationStateLabel('CRAWL_FAILED')).toBe('Crawl failed — not evaluated');
  });
  it('confidenceLabelFor handles a missing confidence object', () => {
    expect(confidenceLabelFor(undefined)).toBe('Confidence unknown');
  });
  it('categoryStatusLabel falls back to a humanized string for an unmapped status', () => {
    expect(categoryStatusLabel('SOMETHING_NEW')).toBe('Something new');
  });
  it('diagnosticLabel falls back to a humanized string for an unmapped code', () => {
    expect(diagnosticLabel('BRAND_NEW_DIAGNOSTIC')).toBe('Brand new diagnostic');
  });
});

describe('isLikelyIntelligenceReportV2Delivery', () => {
  it('accepts a well-shaped delivery payload', () => {
    expect(isLikelyIntelligenceReportV2Delivery({ report: {}, overall: {}, recommendations: [], opportunities: [], narrative: {} })).toBe(true);
  });
  it('rejects an error-shaped response instead of crashing downstream', () => {
    expect(isLikelyIntelligenceReportV2Delivery({ error: 'Not found' })).toBe(false);
    expect(isLikelyIntelligenceReportV2Delivery(null)).toBe(false);
    expect(isLikelyIntelligenceReportV2Delivery('oops')).toBe(false);
  });
});
