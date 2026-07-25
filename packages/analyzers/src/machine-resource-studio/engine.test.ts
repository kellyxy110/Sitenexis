import { describe, expect, it } from 'vitest';
import { buildMachineResourceStudioReport } from './engine';

describe('Machine Resource Studio report engine', () => {
  it('returns truthful unavailable states when an audit has no evidence', () => {
    const report = buildMachineResourceStudioReport({
      audit: { id: 'audit-1', domain: 'example.com', completedAt: null, pageCount: null },
      scores: null,
      aiVisibility: null,
      pages: [],
      issues: [],
    });

    expect(report.overallScore).toBeNull();
    expect(report.recommendations).toHaveLength(0);
    expect(report.limitations).toContain('No crawl pages are stored for this audit.');
    expect(report.limitations).toContain('AI visibility scores are unavailable for this audit.');
  });

  it('creates recommendations that point to the source issue', () => {
    const report = buildMachineResourceStudioReport({
      audit: { id: 'audit-2', domain: 'example.com', completedAt: '2026-07-25T00:00:00.000Z', pageCount: 1 },
      scores: { overall: 54, seoScore: 40, aiScore: 60, schemaScore: 45, linkGraphScore: 70, performanceScore: 65 },
      aiVisibility: null,
      pages: [{ id: 'page-1', url: 'https://example.com', statusCode: 200, isIndexable: true, wordCount: 500, internalLinks: 3, externalLinks: 1 }],
      issues: [{ id: 'issue-1', module: 'seo', type: 'missing-title', severity: 'critical', message: 'Missing page title', recommendation: 'Add a unique title.', pageUrl: 'https://example.com', createdAt: '2026-07-25T00:00:00.000Z' }],
    });

    expect(report.overallScore).toBe(54);
    expect(report.recommendations[0]?.priority).toBe('P0');
    expect(report.recommendations[0]?.evidenceIds).toEqual(['issue:issue-1']);
    expect(report.evidence.some((item) => item.id === 'issue:issue-1')).toBe(true);
  });
});
