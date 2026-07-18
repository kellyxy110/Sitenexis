import { describe, it, expect } from 'vitest';
import { buildFindingPool, filterTraceableRecommendations, type Finding } from '../finding-pool';

describe('buildFindingPool', () => {
  it('includes one entry per Issue, prefixed with issue:', () => {
    const pool = buildFindingPool({
      page: { title: 'x', metaDescription: 'y', h1: 'z', wordCount: 500, seoScore: 80, aiScore: 70 },
      issues: [{ id: 'iss-1', module: 'seo', type: 'missing_alt', severity: 'warning', message: 'Missing alt text' }],
    });
    expect(pool).toContainEqual({ id: 'issue:iss-1', label: '[warning] seo/missing_alt: Missing alt text' });
  });

  it('adds score facts only when scores are present', () => {
    const withScores = buildFindingPool({
      page: { title: 'x', metaDescription: 'y', h1: 'z', wordCount: 500, seoScore: 42, aiScore: null },
      issues: [],
    });
    expect(withScores.some((f) => f.id === 'score:seo')).toBe(true);
    expect(withScores.some((f) => f.id === 'score:ai')).toBe(false);
  });

  it('flags missing title/meta/h1 as findings', () => {
    const pool = buildFindingPool({
      page: { title: null, metaDescription: null, h1: null, wordCount: 200, seoScore: null, aiScore: null },
      issues: [],
    });
    expect(pool.map((f) => f.id)).toEqual(expect.arrayContaining(['fact:missingTitle', 'fact:missingMeta', 'fact:missingH1']));
  });

  it('includes retrieval simulation failures when provided', () => {
    const pool = buildFindingPool({
      page: { title: 'x', metaDescription: 'y', h1: 'z', wordCount: 500, seoScore: 80, aiScore: 70 },
      issues: [],
      retrievalFailures: [{ stage: 'chunk_extraction', description: 'No headings', severity: 'critical' }],
    });
    expect(pool).toContainEqual({ id: 'retrieval:0', label: '[critical] chunk_extraction: No headings' });
  });
});

describe('filterTraceableRecommendations', () => {
  const pool: Finding[] = [
    { id: 'issue:iss-1', label: 'Missing alt text' },
    { id: 'score:seo', label: 'SEO score is 42/100' },
  ];

  it('keeps a recommendation that cites a real finding id', () => {
    const recs = [{ action: 'Add alt text', rationale: 'x', sourceFindingIds: ['issue:iss-1'], expectedImpact: 'y' }];
    expect(filterTraceableRecommendations(recs, pool)).toHaveLength(1);
  });

  it('discards a recommendation with an empty sourceFindingIds array (unfounded)', () => {
    const recs = [{ action: 'Do something', rationale: 'x', sourceFindingIds: [], expectedImpact: 'y' }];
    expect(filterTraceableRecommendations(recs, pool)).toHaveLength(0);
  });

  it('discards a recommendation that cites a hallucinated finding id not in the pool', () => {
    const recs = [{ action: 'Do something', rationale: 'x', sourceFindingIds: ['issue:made-up-id'], expectedImpact: 'y' }];
    expect(filterTraceableRecommendations(recs, pool)).toHaveLength(0);
  });

  it('discards a recommendation only partially backed by real findings', () => {
    const recs = [{ action: 'Do something', rationale: 'x', sourceFindingIds: ['issue:iss-1', 'issue:fake'], expectedImpact: 'y' }];
    expect(filterTraceableRecommendations(recs, pool)).toHaveLength(0);
  });

  it('keeps some and discards others from a mixed batch', () => {
    const recs = [
      { action: 'Real one', rationale: 'x', sourceFindingIds: ['score:seo'], expectedImpact: 'y' },
      { action: 'Fake one', rationale: 'x', sourceFindingIds: ['issue:nonexistent'], expectedImpact: 'y' },
    ];
    const result = filterTraceableRecommendations(recs, pool);
    expect(result).toHaveLength(1);
    expect(result[0]!.action).toBe('Real one');
  });
});
