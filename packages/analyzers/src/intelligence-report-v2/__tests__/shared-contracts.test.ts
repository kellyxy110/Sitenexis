import { describe, expect, it } from 'vitest';
import {
  EVIDENCE_SCOPES,
  EVIDENCE_SOURCE_LAYERS,
  DISCOVERY_SOURCES,
  OBSERVATION_TYPES,
  INTELLIGENCE_REPORT_V2_VERSION_METADATA,
  VERIFICATION_STATES,
  calculateObservedCoverageRatio,
  canAffectScore,
  createAuditCoverage,
  createConfidenceSummary,
  isEvidenceScope,
  isEvidenceSourceLayer,
  isDiscoverySource,
  isObservationType,
  isFailureState,
  isUnavailableState,
  isVerifiedState,
  isVerificationState,
  requiresCautiousNarrative,
  resolveIntelligenceReportVersionMetadata,
  type EvidenceProjection,
} from '@sitenexis/shared';

describe('Intelligence Report v2 shared contracts', () => {
  it('defines the documented verification states and their cautious handling', () => {
    expect(VERIFICATION_STATES).toContain('CONFIRMED');
    expect(VERIFICATION_STATES).toContain('PROVIDER_UNAVAILABLE');
    expect(isVerificationState('CONFLICTING')).toBe(true);
    expect(isVerificationState('healthy')).toBe(false);
    expect(isVerifiedState('CONFIRMED')).toBe(true);
    expect(isFailureState('CRAWL_FAILED')).toBe(true);
    expect(isUnavailableState('PROVIDER_UNAVAILABLE')).toBe(true);
    expect(canAffectScore('LIKELY')).toBe(true);
    expect(canAffectScore('CRAWL_FAILED')).toBe(false);
    expect(requiresCautiousNarrative('LIKELY')).toBe(true);
    expect(requiresCautiousNarrative('CONFIRMED')).toBe(false);
  });

  it('defines the documented source layers and scopes', () => {
    expect(EVIDENCE_SOURCE_LAYERS).toContain('RAW_HTML');
    expect(EVIDENCE_SOURCE_LAYERS).toContain('USER_CONNECTED_DATA');
    expect(EVIDENCE_SCOPES).toContain('PAGE');
    expect(EVIDENCE_SCOPES).toContain('PROVIDER_DATA');
    expect(isEvidenceSourceLayer('SITEMAP')).toBe(true);
    expect(isEvidenceSourceLayer('crawler')).toBe(false);
    expect(isEvidenceScope('HISTORICAL_TREND')).toBe(true);
    expect(isEvidenceScope('site')).toBe(false);
  });

  it('supports minimal and detailed evidence projections without requiring legacy records to conform', () => {
    const minimal: EvidenceProjection = {
      id: 'evidence-1',
      auditId: 'audit-1',
      domain: 'example.com',
      scope: 'PAGE',
      category: 'technical-seo',
      title: 'Canonical is missing',
      description: 'No canonical link was detected in the fetched document.',
      confidence: createConfidenceSummary({ score: 1, reasons: ['Direct DOM evidence'] }),
      verificationState: 'NOT_DETECTED',
      sourceLayer: 'RAW_HTML',
      detectedAt: '2026-08-02T00:00:00.000Z',
      retryCount: 0,
    };

    const detailed: EvidenceProjection = {
      ...minimal,
      id: 'evidence-2',
      pageId: 'page-1',
      issueId: 'issue-1',
      url: 'https://example.com/about',
      canonicalUrl: 'https://example.com/about',
      rawValue: { canonicalCount: 0 },
      expectedValue: '<link rel="canonical">',
      selector: 'head > link[rel~="canonical"]',
      scoreImpacts: [{ category: 'Technical SEO', impact: -2, kind: 'primary' }],
      metadata: { extractionMode: 'raw' },
    };

    expect(minimal.url).toBeUndefined();
    expect(detailed.scoreImpacts?.[0].category).toBe('Technical SEO');
  });

  it('keeps legacy version metadata readable without assigning v2', () => {
    expect(resolveIntelligenceReportVersionMetadata(undefined)).toEqual({
      scoringModelVersion: 'legacy',
      reportVersion: 'v1',
      evidenceModelVersion: 'legacy',
      crawlerVersion: 'legacy',
    });
    expect(resolveIntelligenceReportVersionMetadata({ reportVersion: 'v1' }).reportVersion).toBe('v1');
    expect(INTELLIGENCE_REPORT_V2_VERSION_METADATA.reportVersion).toBe('v2');
    expect(resolveIntelligenceReportVersionMetadata({ reportVersion: 'v2' }).reportVersion).toBe('v2');
  });

  it('models unknown, high, and contradiction-aware confidence without scoring an audit', () => {
    expect(createConfidenceSummary()).toEqual({
      score: undefined,
      label: 'UNKNOWN',
      reasons: [],
      evidenceCount: undefined,
      contradictionCount: undefined,
      sourceLayerCount: undefined,
      coverageInfluence: undefined,
    });
    expect(createConfidenceSummary({ score: 0.9, reasons: ['Two independent sources'] }).label).toBe('HIGH');
    expect(createConfidenceSummary({ score: 0.2, contradictionCount: 1 }).label).toBe('LOW');
  });

  it('represents empty, full, partial, failed, and provider-unavailable coverage truthfully', () => {
    expect(createAuditCoverage().coverageRatio).toBeUndefined();
    expect(createAuditCoverage({ attemptedUrls: 4, successfulUrls: 4 }).coverageRatio).toBe(1);
    expect(createAuditCoverage({ attemptedUrls: 4, successfulUrls: 1, partialUrls: 2 }).coverageRatio).toBe(0.5);
    expect(createAuditCoverage({ attemptedUrls: 4, failedUrls: 4 }).coverageRatio).toBe(0);

    const unavailableProviderCoverage = createAuditCoverage({
      attemptedUrls: 2,
      successfulUrls: 2,
      providersUnavailable: ['Search Console'],
    });
    expect(unavailableProviderCoverage.coverageRatio).toBe(1);
    expect(unavailableProviderCoverage.providersUnavailable).toEqual(['Search Console']);
    expect(calculateObservedCoverageRatio({ attemptedUrls: 0, successfulUrls: 0, partialUrls: 0, excludedUrls: 0 })).toBeUndefined();
  });
  it('keeps module lineage and observation classification optional for legacy evidence', () => {
    const legacyCompatible: EvidenceProjection = {
      id: 'legacy-compatible',
      auditId: 'audit-1',
      domain: 'example.com',
      scope: 'PAGE',
      category: 'technical-seo',
      title: 'Observed title',
      description: 'A direct page title extraction.',
      confidence: createConfidenceSummary({ score: 1 }),
      verificationState: 'CONFIRMED',
      sourceLayer: 'RAW_HTML',
      detectedAt: '2026-08-02T00:00:00.000Z',
      retryCount: 0,
    };

    const inferredWithLineage: EvidenceProjection = {
      ...legacyCompatible,
      id: 'inference-with-lineage',
      observationType: 'INFERENCE',
      moduleId: 'entity-consistency',
      moduleVersion: '2.1.0',
      extractorVersion: 'html-extractor-1.4.0',
    };

    expect(legacyCompatible.observationType).toBeUndefined();
    expect(OBSERVATION_TYPES).toContain('OBSERVATION');
    expect(isObservationType('OBSERVATION')).toBe(true);
    expect(isObservationType('INFERENCE')).toBe(true);
    expect(isObservationType('FINDING')).toBe(false);
    expect(inferredWithLineage.moduleVersion).toBe('2.1.0');
    expect(inferredWithLineage.extractorVersion).toBe('html-extractor-1.4.0');
  });

  it('supports discovery provenance and supplementary metadata without requiring it', () => {
    for (const source of ['SITEMAP', 'INTERNAL_LINK', 'ROBOTS', 'SEARCH_CONSOLE', 'USER_SUPPLIED'] as const) {
      expect(DISCOVERY_SOURCES).toContain(source);
      expect(isDiscoverySource(source)).toBe(true);
    }
    expect(isDiscoverySource('browser-history')).toBe(false);

    const discoveredProjection: EvidenceProjection = {
      id: 'evidence-discovery',
      auditId: 'audit-1',
      domain: 'example.com',
      scope: 'PAGE',
      category: 'crawlability',
      title: 'Sitemap URL observed',
      description: 'The URL was discovered in the declared XML sitemap.',
      confidence: createConfidenceSummary({ score: 0.9 }),
      verificationState: 'CONFIRMED',
      sourceLayer: 'SITEMAP',
      detectedAt: '2026-08-02T00:00:00.000Z',
      retryCount: 0,
      observationType: 'OBSERVATION',
      discoverySource: 'SITEMAP',
      discoveredFrom: 'https://example.com/sitemap.xml',
      sourceUrl: 'https://example.com/sitemap.xml',
      extractionMethod: 'xml-parser',
      extractorVersion: 'sitemap-parser-1.0.0',
      provenanceMetadata: {
        sourceDocument: 'sitemap.xml',
        transformation: 'xml-urlset-entry',
        observedAt: '2026-08-02T00:00:00.000Z',
        sourceIdentifier: 'urlset:42',
        details: { priority: '0.8' },
      },
    };

    expect(discoveredProjection.discoverySource).toBe('SITEMAP');
    expect(discoveredProjection.provenanceMetadata?.sourceIdentifier).toBe('urlset:42');
  });
});
