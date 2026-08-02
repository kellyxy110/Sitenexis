import { describe, expect, it } from 'vitest';
import {
  projectLegacyAuditEvidence,
  projectLegacyIssueToEvidence,
  projectLegacyPageToEvidence,
  type LegacyIssueEvidenceRecord,
  type LegacyPageEvidenceRecord,
} from '@sitenexis/shared';

const page: LegacyPageEvidenceRecord = {
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
  contentHash: 'content-hash',
  extractionMode: 'static-html',
  extractionConfidence: 0.92,
  crawledAt: new Date('2026-08-02T00:00:00.000Z'),
};

describe('legacy read-time evidence projection adapter', () => {
  it('projects only stored page values without mutating a raw-extracted legacy record', () => {
    const before = JSON.stringify(page);
    const projections = projectLegacyPageToEvidence(page);

    expect(JSON.stringify(page)).toBe(before);
    expect(projections.find((projection) => projection.issueCode === 'title')?.rawValue).toBe('About Example');
    expect(projections.find((projection) => projection.issueCode === 'h1')?.rawValue).toBe('About us');
    expect(projections.find((projection) => projection.issueCode === 'h2')?.rawValue).toEqual(['Our history', 'Our team']);
    expect(projections.find((projection) => projection.issueCode === 'canonical')).toMatchObject({
      rawValue: '/about',
      normalizedValue: 'https://example.com/about',
      sourceLayer: 'RAW_HTML',
      observationType: 'OBSERVATION',
    });
    expect(projections.every((projection) => projection.confidence.label === 'HIGH')).toBe(true);
  });

  it('maps rendered extraction when the stored extraction mode supports it', () => {
    const projections = projectLegacyPageToEvidence({
      ...page,
      id: 'page-rendered',
      extractionMode: 'headless-rendered',
    });

    expect(projections.every((projection) => projection.sourceLayer === 'RENDERED_DOM')).toBe(true);
  });

  it('does not fabricate optional page evidence, source layer, or confidence', () => {
    const projections = projectLegacyPageToEvidence({
      id: 'page-minimal',
      auditId: 'audit-1',
      url: 'https://example.com/minimal',
      statusCode: 200,
    });

    expect(projections).toHaveLength(1);
    expect(projections[0]).toMatchObject({
      issueCode: 'http-status',
      rawValue: 200,
      sourceLayer: undefined,
    });
    expect(projections[0].confidence.label).toBe('UNKNOWN');
    expect(projections[0].ruleId).toBeUndefined();
    expect(projections[0].evidenceSnippet).toBeUndefined();
  });

  it('projects page-linked issues conservatively without rewriting severity or recommendation', () => {
    const issue: LegacyIssueEvidenceRecord = {
      id: 'issue-1',
      auditId: 'audit-1',
      pageId: page.id,
      pageUrl: page.url!,
      module: 'seo',
      type: 'missing_h1',
      severity: 'high',
      message: 'Missing H1',
      recommendation: 'Add a descriptive H1.',
      renderMethod: 'headless-rendered',
      createdAt: new Date('2026-08-02T00:01:00.000Z'),
    };
    const before = JSON.stringify(issue);
    const projection = projectLegacyIssueToEvidence(issue);

    expect(JSON.stringify(issue)).toBe(before);
    expect(projection).toMatchObject({
      issueId: 'issue-1',
      pageId: 'page-1',
      category: 'seo',
      issueCode: 'missing_h1',
      severity: 'high',
      recommendation: 'Add a descriptive H1.',
      verificationState: 'PARTIAL',
      observationType: 'INFERENCE',
      sourceLayer: 'RENDERED_DOM',
    });
    expect(projection?.ruleId).toBeUndefined();
    expect(projection?.evidenceSnippet).toBeUndefined();
    expect(projection?.confidence.label).toBe('UNKNOWN');
  });

  it('preserves direct failure semantics only when the legacy issue type supports them', () => {
    const projection = projectLegacyIssueToEvidence({
      id: 'issue-failure',
      auditId: 'audit-1',
      module: 'crawler',
      type: 'crawl_failed',
      severity: 'critical',
      message: 'Crawl failed',
      recommendation: 'Retry the crawl.',
    }, { domain: 'example.com' });

    expect(projection).toMatchObject({
      verificationState: 'CRAWL_FAILED',
      observationType: 'OBSERVATION',
      severity: 'critical',
    });
  });

  it('supports domain-level and incomplete historical records without throwing', () => {
    const domainIssue = projectLegacyIssueToEvidence({
      id: 'issue-domain',
      auditId: 'audit-1',
      module: 'robots',
      type: 'missing_robots_txt',
      severity: 'warning',
      message: 'robots.txt could not be confirmed',
      recommendation: 'Verify robots.txt.',
    }, { domain: 'example.com' });

    expect(domainIssue).toMatchObject({ scope: 'DOMAIN', sourceLayer: undefined, detectedAt: undefined });
    expect(projectLegacyPageToEvidence({ id: 'incomplete', auditId: 'audit-1' })).toEqual([]);
  });

  it('combines caller-supplied v1 records in memory without requiring new v2 fields', () => {
    const evidence = projectLegacyAuditEvidence({
      pages: [page],
      issues: [{
        id: 'issue-combined',
        auditId: 'audit-1',
        pageId: page.id,
        module: 'seo',
        type: 'missing_title',
        severity: 'warning',
        message: 'Title issue',
        recommendation: 'Review the title.',
      }],
    }, { domain: 'example.com' });

    expect(evidence.some((projection) => projection.id === 'legacy:page:page-1:title')).toBe(true);
    expect(evidence.some((projection) => projection.id === 'legacy:issue:issue-combined')).toBe(true);
  });
});
