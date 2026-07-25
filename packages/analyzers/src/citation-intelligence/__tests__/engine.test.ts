import { describe, expect, it } from 'vitest';
import type { CrawledPage } from '@sitenexis/shared';
import { analyzeCitationIntelligence } from '../engine';

function page(url: string, internalLinks: string[], externalLinks: string[], schemaMarkup: unknown[] = []): CrawledPage {
  return {
    url, statusCode: 200, redirectChain: [], title: 'Test page', metaDescription: null, h1: 'Test', headings: [], bodyText: 'Evidence-based content', wordCount: 3,
    internalLinks, externalLinks, images: [], canonicalUrl: url, robotsDirectives: [], schemaMarkup, responseTimeMs: 100, contentType: 'text/html', crawledAt: new Date(),
  };
}

describe('Citation Intelligence', () => {
  it('builds deterministic first-party evidence and scores', () => {
    const result = analyzeCitationIntelligence({
      auditId: 'audit-1', domain: 'example.com', pages: [
        page('https://example.com/', ['https://example.com/research'], ['https://www.gov.uk/guidance/test', 'https://github.com/example/repo'], [{ '@type': 'Organization', sameAs: ['https://www.linkedin.com/company/example'] }]),
        page('https://example.com/research', [], ['https://doi.org/10.1234/example']),
      ],
      generatedAt: new Date('2026-01-01T00:00:00.000Z'),
    });
    expect(result.status).toBe('completed');
    expect(result.availabilityState).toBe('partially_available');
    expect(result.providerState).toBe('not_configured');
    expect(result.evidenceState).toBe('evidence_found');
    expect(result.counts.pagesAnalyzed).toBe(2);
    expect(result.counts.externalReferences).toBe(3);
    expect(result.counts.sameAsReferences).toBe(1);
    expect(result.signals.some((signal) => signal.type === 'government')).toBe(true);
    expect(result.signals.some((signal) => signal.type === 'research')).toBe(true);
    expect(result.scores.citation).not.toBeNull();
  });

  it('reports no-data honestly instead of returning zero scores', () => {
    const result = analyzeCitationIntelligence({ domain: 'example.com', pages: [] });
    expect(result.status).toBe('no_data');
    expect(result.availabilityState).toBe('unavailable');
    expect(result.scores.citation).toBeNull();
  });

  it('separates no observed evidence from unavailable external coverage', () => {
    const result = analyzeCitationIntelligence({ domain: 'example.com', pages: [page('https://example.com/', [], [])] });
    expect(result.availabilityState).toBe('available_no_evidence');
    expect(result.evidenceState).toBe('no_evidence_found');
    expect(result.providerState).toBe('not_configured');
    expect(result.limitations.join(' ').toLowerCase()).toContain('external');
  });

  it('ignores malformed structured-data entries without inventing signals', () => {
    const result = analyzeCitationIntelligence({ domain: 'example.com', pages: [page('https://example.com/', [], [], [null, 42, { '@type': 'WebPage' }])] });
    expect(result.status).toBe('completed');
    expect(result.counts.sameAsReferences).toBe(0);
  });
});
