import { describe, expect, it } from 'vitest';
import {
  compareRawAndRenderedEvidence,
  composeIntelligenceReportV2Input,
  createAuditCoverage,
  createConfidenceSummary,
  normalizeLegacyModuleState,
  projectLegacyPageToEvidence,
  type EvidenceProjection,
} from '@sitenexis/shared';

function evidence(overrides: Partial<EvidenceProjection> = {}): EvidenceProjection {
  return {
    id: 'evidence-1', auditId: 'audit-1', domain: 'example.com', scope: 'PAGE', category: 'on-page-seo',
    title: 'H1 heading', description: 'Observed H1 heading.', confidence: createConfidenceSummary({ score: 0.9 }),
    verificationState: 'CONFIRMED', observationType: 'OBSERVATION', ...overrides,
  };
}

describe('Intelligence Report v2 input composition', () => {
  it('composes a minimal legacy-compatible envelope with unknown confidence', () => {
    const result = composeIntelligenceReportV2Input({ audit: { auditId: 'audit-1', domain: 'example.com' } });

    expect(result.input).toMatchObject({
      audit: { auditId: 'audit-1', domain: 'example.com' },
      version: { scoringModelVersion: 'legacy', reportVersion: 'v1' },
      evidence: [], modules: [], providers: [],
      confidence: { label: 'UNKNOWN', reasons: [] },
    });
    expect(result.validation).toEqual({ valid: true, warnings: [], errors: [] });
  });

  it('preserves a rich caller-supplied envelope without calculating scores', () => {
    const comparison = compareRawAndRenderedEvidence(
      { availability: 'AVAILABLE', page: { url: 'https://example.com/', h1: 'Raw H1' } },
      { availability: 'AVAILABLE', page: { url: 'https://example.com/', h1: 'Rendered H1' } },
    )[3];
    const result = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com', projectId: 'project-1', auditExecutionMode: 'WORKER' },
      version: { scoringModelVersion: 'v2', reportVersion: 'v2', evidenceModelVersion: 'v2', crawlerVersion: 'crawler-2' },
      evidence: [evidence({ moduleId: 'scout' })],
      rawRenderedComparisons: [comparison],
      modules: [{ moduleId: 'scout', state: 'COMPLETED', evidenceCount: 1 }],
      coverage: createAuditCoverage({ discoveredUrls: 2, attemptedUrls: 2, successfulUrls: 2, providersAvailable: ['serp'] }),
      confidence: createConfidenceSummary({ score: 0.8, reasons: ['Complete crawl.'] }),
      providers: [{ provider: 'serp', available: true, configured: true }],
      metadata: { assemblerVersion: 'phase-7', dataCompletenessNotes: ['Provider data supplied.'] },
    });

    expect(result.validation.valid).toBe(true);
    expect(result.input.version.crawlerVersion).toBe('crawler-2');
    expect(result.input.rawRenderedComparisons).toHaveLength(1);
    expect(result.input.coverage?.successfulUrls).toBe(2);
    expect(result.input.providers[0]).toMatchObject({ provider: 'serp', available: true });
    expect(result.input.metadata?.assemblerVersion).toBe('phase-7');
  });

  it('flags cross-audit and domain contamination while preserving supplied evidence', () => {
    const result = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com' },
      evidence: [evidence({ auditId: 'audit-2', domain: 'other.example', moduleId: 'missing-module' })],
      rawRenderedComparisons: [{
        field: 'canonicalUrl', rawAvailability: 'AVAILABLE', renderedAvailability: 'AVAILABLE',
        relationship: 'MATCH', confidence: createConfidenceSummary(), evidenceReferences: [], url: 'https://other.example/page',
      }],
      modules: [{ moduleId: 'scout', state: 'COMPLETED' }, { moduleId: 'scout', state: 'PARTIAL', partial: true }],
    });

    expect(result.validation.valid).toBe(false);
    expect(result.validation.errors.map((entry) => entry.code)).toEqual(expect.arrayContaining(['CROSS_AUDIT_EVIDENCE', 'DOMAIN_MISMATCH']));
    expect(result.validation.warnings.map((entry) => entry.code)).toEqual(expect.arrayContaining(['DUPLICATE_MODULE_SUMMARY', 'MISSING_MODULE_SUMMARY']));
    expect(result.input.evidence).toHaveLength(1);
  });

  it('keeps historical evidence separate from current-audit evidence', () => {
    const result = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com' },
      evidence: [evidence()],
      historicalEvidence: [evidence({ id: 'historical-1', auditId: 'audit-0' })],
    });

    expect(result.validation.valid).toBe(true);
    expect(result.input.evidence.map((item) => item.id)).toEqual(['evidence-1']);
    expect(result.input.historicalEvidence?.map((item) => item.id)).toEqual(['historical-1']);
  });

  it('supports provider availability without inferring provider results from absence', () => {
    const result = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com' },
      providers: [
        { provider: 'backlink-provider', available: false, configured: false, reasonCode: 'MISSING_CREDENTIAL' },
        { provider: 'search-console', available: true, configured: true },
      ],
    });

    expect(result.input.providers).toEqual(expect.arrayContaining([
      expect.objectContaining({ provider: 'backlink-provider', available: false }),
      expect.objectContaining({ provider: 'search-console', available: true }),
    ]));
  });

  it('does not mutate caller input arrays or objects', () => {
    const input = {
      audit: { auditId: 'audit-1', domain: 'example.com' },
      evidence: [evidence({ metadata: { nested: 'value' } })],
      modules: [{ moduleId: 'scout', state: 'COMPLETED' as const, metadata: { source: 'legacy' } }],
      metadata: { dataCompletenessNotes: ['complete'], callerMetadata: { source: 'test' } },
    };
    const before = JSON.stringify(input);
    Object.freeze(input.evidence);
    Object.freeze(input.modules);

    const result = composeIntelligenceReportV2Input(input);

    expect(JSON.stringify(input)).toBe(before);
    expect(result.input.evidence).not.toBe(input.evidence);
    expect(result.input.modules).not.toBe(input.modules);
  });

  it('composes Phase 3, 4, and 6 read-time outputs together', () => {
    const legacyEvidence = projectLegacyPageToEvidence({
      id: 'page-1', auditId: 'audit-1', url: 'https://example.com/', h1: 'Example H1', extractionMode: 'raw',
    }, { domain: 'example.com' });
    const comparisons = compareRawAndRenderedEvidence(
      { availability: 'AVAILABLE', page: { url: 'https://example.com/', canonicalUrl: 'https://example.com/' } },
      { availability: 'AVAILABLE', page: { url: 'https://example.com/', canonicalUrl: 'https://example.com/' } },
    );
    const module = normalizeLegacyModuleState({ moduleId: 'scout', output: { state: 'complete' } });
    const result = composeIntelligenceReportV2Input({
      audit: { auditId: 'audit-1', domain: 'example.com' }, evidence: legacyEvidence,
      rawRenderedComparisons: comparisons, modules: [module],
    });

    expect(result.validation.valid).toBe(true);
    expect(result.input.evidence).not.toHaveLength(0);
    expect(result.input.rawRenderedComparisons).toHaveLength(10);
    expect(result.input.modules[0]?.state).toBe('COMPLETED');
  });
});