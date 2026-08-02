import { describe, expect, it } from 'vitest';
import {
  compareRawAndRenderedEvidence,
  projectRawExtractionEvidence,
  projectRawRenderedComparison,
  projectRenderedExtractionEvidence,
  type ExtractionEvidenceSnapshot,
} from '@sitenexis/shared';

const raw: ExtractionEvidenceSnapshot = {
  availability: 'AVAILABLE',
  extractionMethod: 'static-html',
  extractionConfidence: 1,
  sourceUrl: 'https://example.com/page',
  observedAt: new Date('2026-08-02T00:00:00.000Z'),
  page: {
    url: 'https://example.com/page',
    requestedUrl: 'https://example.com/page',
    finalUrl: 'https://example.com/page',
    title: 'Example page',
    metaDescription: 'An example page.',
    canonicalUrl: 'https://example.com/page',
    h1: 'Example heading',
    headings: [{ level: 2, text: 'First section' }, { level: 2, text: 'Second section' }],
    bodyText: 'Static content',
    contentHash: 'raw-hash',
    schemaTypes: ['Organization'],
    robotsDirectives: ['index', 'follow'],
    openGraph: { title: 'Example page' },
  },
};

const rendered: ExtractionEvidenceSnapshot = {
  ...raw,
  extractionMethod: 'headless-rendered',
  extractionConfidence: 0.9,
  page: { ...raw.page },
};

function comparison(
  field: Parameters<typeof compareRawAndRenderedEvidence>[0] extends never ? never : string,
  rawSnapshot = raw,
  renderedSnapshot = rendered,
) {
  return compareRawAndRenderedEvidence(rawSnapshot, renderedSnapshot).find((item) => item.field === field);
}

describe('raw versus rendered evidence projection', () => {
  it('projects direct raw and rendered observations without emitting findings', () => {
    const rawEvidence = projectRawExtractionEvidence(raw, { auditId: 'audit-1' });
    const renderedEvidence = projectRenderedExtractionEvidence(rendered, { auditId: 'audit-1' });

    expect(rawEvidence.find((item) => item.issueCode === 'title')).toMatchObject({
      sourceLayer: 'RAW_HTML', rawValue: 'Example page',
    });
    expect(rawEvidence.find((item) => item.issueCode === 'h1')).toMatchObject({
      sourceLayer: 'RAW_HTML', rawValue: 'Example heading',
    });
    expect(rawEvidence.find((item) => item.issueCode === 'canonicalUrl')).toMatchObject({
      sourceLayer: 'RAW_HTML', observationType: 'OBSERVATION', rawValue: 'https://example.com/page',
    });
    expect(rawEvidence.find((item) => item.issueCode === 'bodyTextLength')?.rawValue).toBe(14);
    expect(rawEvidence.find((item) => item.issueCode === 'contentHash')?.rawValue).toBe('raw-hash');
    expect(renderedEvidence.find((item) => item.issueCode === 'title')).toMatchObject({
      sourceLayer: 'RENDERED_DOM', rawValue: 'Example page',
    });
    expect(renderedEvidence.find((item) => item.issueCode === 'h1')).toMatchObject({
      sourceLayer: 'RENDERED_DOM', observationType: 'OBSERVATION', rawValue: 'Example heading',
    });
    expect(rawEvidence.every((item) => item.category !== 'finding')).toBe(true);
  });

  it('matches title, H1, canonical, and order-independent H2 collections', () => {
    const reorderedRendered: ExtractionEvidenceSnapshot = {
      ...rendered,
      page: { ...rendered.page!, headings: [{ level: 2, text: 'Second section' }, { level: 2, text: ' First section ' }] },
    };

    expect(comparison('title')?.relationship).toBe('MATCH');
    expect(comparison('h1')?.relationship).toBe('MATCH');
    expect(comparison('canonicalUrl')?.relationship).toBe('MATCH');
    expect(comparison('h2', raw, reorderedRendered)?.relationship).toBe('MATCH');
    expect(comparison('schemaTypes')?.relationship).toBe('MATCH');
  });

  it('reports direct raw/rendered differences without creating a final finding', () => {
    const changed: ExtractionEvidenceSnapshot = {
      ...rendered,
      page: {
        ...rendered.page!,
        title: 'Rendered title',
        h1: 'Rendered heading',
        canonicalUrl: 'https://example.com/',
      },
    };
    const titleComparison = comparison('title', raw, changed)!;

    expect(titleComparison.relationship).toBe('DIFFERENT');
    expect(comparison('h1', raw, changed)?.relationship).toBe('DIFFERENT');
    expect(comparison('schemaTypes', raw, { ...changed, page: { ...changed.page!, schemaTypes: ['WebPage'] } })?.relationship).toBe('DIFFERENT');
    expect(comparison('canonicalUrl', raw, changed)).toMatchObject({
      rawValue: 'https://example.com/page',
      renderedValue: 'https://example.com/',
      relationship: 'DIFFERENT',
    });
    expect(projectRawRenderedComparison(titleComparison, { auditId: 'audit-1' })).toMatchObject({
      observationType: 'INFERENCE', verificationState: 'INFERRED', category: 'extraction-comparison',
    });
  });

  it('distinguishes raw-only, rendered-only, and both-missing observed fields', () => {
    const rawMissingH1: ExtractionEvidenceSnapshot = { ...raw, page: { ...raw.page!, h1: null } };
    const renderedMissingH1: ExtractionEvidenceSnapshot = { ...rendered, page: { ...rendered.page!, h1: null } };

    expect(comparison('h1', rawMissingH1, rendered)?.relationship).toBe('RENDERED_ONLY');
    expect(comparison('h1', raw, renderedMissingH1)?.relationship).toBe('RAW_ONLY');
    expect(comparison('h1', rawMissingH1, renderedMissingH1)?.relationship).toBe('BOTH_MISSING');
    expect(projectRawRenderedComparison(comparison('h1', rawMissingH1, renderedMissingH1)!, { auditId: 'audit-1' })).toBeUndefined();
  });

  it('keeps failed and unattempted extraction distinct from missing evidence', () => {
    const notAttempted: ExtractionEvidenceSnapshot = { availability: 'NOT_ATTEMPTED' };
    const failed: ExtractionEvidenceSnapshot = { availability: 'FAILED' };

    expect(comparison('canonicalUrl', raw, notAttempted)).toMatchObject({ relationship: 'NOT_COMPARABLE', renderedAvailability: 'NOT_ATTEMPTED' });
    expect(comparison('h1', raw, failed)).toMatchObject({ relationship: 'NOT_COMPARABLE', renderedAvailability: 'FAILED' });
    expect(comparison('title', failed, rendered)).toMatchObject({ relationship: 'NOT_COMPARABLE', rawAvailability: 'FAILED' });
  });

  it('does not fabricate canonical values, source layers, provenance, or confidence', () => {
    const sparseRaw: ExtractionEvidenceSnapshot = {
      availability: 'AVAILABLE',
      page: { url: 'https://example.com/page', canonicalUrl: null, h1: null },
    };
    const sparseRendered: ExtractionEvidenceSnapshot = {
      availability: 'AVAILABLE',
      page: { url: 'https://example.com/page', canonicalUrl: 'https://example.com/page', h1: null },
    };
    const canonicalComparison = comparison('canonicalUrl', sparseRaw, sparseRendered)!;

    expect(canonicalComparison.relationship).toBe('RENDERED_ONLY');
    expect(canonicalComparison.rawValue).toBeNull();
    expect(canonicalComparison.renderedValue).toBe('https://example.com/page');
    expect(canonicalComparison.confidence.label).toBe('UNKNOWN');
    expect(canonicalComparison.evidenceReferences).toEqual([
      { sourceLayer: 'RAW_HTML', sourceUrl: 'https://example.com/page', observedAt: undefined, extractionMethod: undefined },
      { sourceLayer: 'RENDERED_DOM', sourceUrl: 'https://example.com/page', observedAt: undefined, extractionMethod: undefined },
    ]);
    expect(projectRawExtractionEvidence({ availability: 'NOT_ATTEMPTED' }, { auditId: 'audit-1' })).toEqual([]);
  });

  it('does not mutate raw or rendered inputs', () => {
    const beforeRaw = JSON.stringify(raw);
    const beforeRendered = JSON.stringify(rendered);
    compareRawAndRenderedEvidence(raw, rendered);
    projectRawExtractionEvidence(raw, { auditId: 'audit-1' });
    projectRenderedExtractionEvidence(rendered, { auditId: 'audit-1' });

    expect(JSON.stringify(raw)).toBe(beforeRaw);
    expect(JSON.stringify(rendered)).toBe(beforeRendered);
  });
});
