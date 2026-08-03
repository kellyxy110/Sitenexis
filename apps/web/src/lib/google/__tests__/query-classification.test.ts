import { describe, it, expect } from 'vitest';
import { classifyQueries, groupQueriesByClassification, type QueryPeriodStat } from '../query-classification';

const stat = (overrides: Partial<QueryPeriodStat> & { query: string }): QueryPeriodStat => ({
  clicks: 0, impressions: 0, ctr: 0, avgPosition: 0, ...overrides,
});

describe('classifyQueries', () => {
  it('flags a query as rising when impressions grew well past the trend threshold', () => {
    const current = [stat({ query: 'ai visibility audit', impressions: 1200, clicks: 40, ctr: 0.033, avgPosition: 8 })];
    const previous = [stat({ query: 'ai visibility audit', impressions: 800, clicks: 30, ctr: 0.0375, avgPosition: 9 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).toContain('rising');
  });

  it('flags a query as declining when impressions fell well past the trend threshold', () => {
    const current = [stat({ query: 'seo audit tool', impressions: 400, clicks: 10, ctr: 0.025, avgPosition: 12 })];
    const previous = [stat({ query: 'seo audit tool', impressions: 900, clicks: 25, ctr: 0.0278, avgPosition: 10 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).toContain('declining');
  });

  it('does not flag a query as rising or declining for noise-level movement', () => {
    const current = [stat({ query: 'stable query', impressions: 1010, clicks: 20, ctr: 0.0198, avgPosition: 6 })];
    const previous = [stat({ query: 'stable query', impressions: 1000, clicks: 20, ctr: 0.02, avgPosition: 6 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).not.toContain('rising');
    expect(q!.classifications).not.toContain('declining');
  });

  it('flags high-impression, low-CTR queries using the same thresholds as the CTR opportunity detector', () => {
    const current = [stat({ query: 'ai visibility audit', impressions: 1840, clicks: 13, ctr: 0.007, avgPosition: 7.2 })];

    const [q] = classifyQueries(current, []);

    expect(q!.classifications).toContain('high_impression_low_ctr');
  });

  it('does not flag a low-impression query even with a low CTR', () => {
    const current = [stat({ query: 'niche query', impressions: 50, clicks: 0, ctr: 0, avgPosition: 15 })];

    const [q] = classifyQueries(current, []);

    expect(q!.classifications).not.toContain('high_impression_low_ctr');
  });

  it('flags near-page-one opportunities for positions 11-20 inclusive', () => {
    const current = [
      stat({ query: 'edge low', impressions: 100, avgPosition: 11 }),
      stat({ query: 'edge high', impressions: 100, avgPosition: 20 }),
      stat({ query: 'page one', impressions: 100, avgPosition: 10 }),
      stat({ query: 'page three', impressions: 100, avgPosition: 21 }),
    ];

    const classified = classifyQueries(current, []);
    const byQuery = new Map(classified.map((c) => [c.query, c]));

    expect(byQuery.get('edge low')!.classifications).toContain('near_page_one');
    expect(byQuery.get('edge high')!.classifications).toContain('near_page_one');
    expect(byQuery.get('page one')!.classifications).not.toContain('near_page_one');
    expect(byQuery.get('page three')!.classifications).not.toContain('near_page_one');
  });

  it('flags gaining position when the position number decreases by at least the swing threshold', () => {
    const current = [stat({ query: 'improving query', avgPosition: 5, impressions: 200 })];
    const previous = [stat({ query: 'improving query', avgPosition: 9, impressions: 200 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).toContain('gaining_position');
    expect(q!.positionDelta).toBe(4);
  });

  it('flags losing position when the position number increases by at least the swing threshold', () => {
    const current = [stat({ query: 'slipping query', avgPosition: 14, impressions: 200 })];
    const previous = [stat({ query: 'slipping query', avgPosition: 9, impressions: 200 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).toContain('losing_position');
    expect(q!.positionDelta).toBe(-5);
  });

  it('never claims a position gain/loss for a query with no previous-period data', () => {
    const current = [stat({ query: 'brand new query', avgPosition: 5, impressions: 100 })];

    const [q] = classifyQueries(current, []);

    expect(q!.positionDelta).toBeNull();
    expect(q!.classifications).not.toContain('gaining_position');
    expect(q!.classifications).not.toContain('losing_position');
  });

  it('a query can carry multiple simultaneous classifications', () => {
    const current = [stat({ query: 'multi', impressions: 2000, clicks: 10, ctr: 0.005, avgPosition: 15 })];
    const previous = [stat({ query: 'multi', impressions: 1000, clicks: 8, ctr: 0.008, avgPosition: 15 })];

    const [q] = classifyQueries(current, previous);

    expect(q!.classifications).toContain('rising');
    expect(q!.classifications).toContain('high_impression_low_ctr');
    expect(q!.classifications).toContain('near_page_one');
  });

  it('is deterministic for identical inputs', () => {
    const current = [stat({ query: 'x', impressions: 500, clicks: 5, ctr: 0.01, avgPosition: 12 })];
    const previous = [stat({ query: 'x', impressions: 300, clicks: 3, ctr: 0.01, avgPosition: 14 })];

    expect(classifyQueries(current, previous)).toEqual(classifyQueries(current, previous));
  });
});

describe('groupQueriesByClassification', () => {
  it('places each classified query under every classification it carries, and none it does not', () => {
    const current = [
      stat({ query: 'rising-only', impressions: 1000, clicks: 20, ctr: 0.02, avgPosition: 5 }),
      stat({ query: 'near-page-one-only', impressions: 100, clicks: 5, ctr: 0.05, avgPosition: 12 }),
    ];
    const previous = [stat({ query: 'rising-only', impressions: 500, clicks: 10, ctr: 0.02, avgPosition: 5 })];

    const groups = groupQueriesByClassification(classifyQueries(current, previous));

    expect(groups.rising.map((q) => q.query)).toEqual(['rising-only']);
    expect(groups.near_page_one.map((q) => q.query)).toEqual(['near-page-one-only']);
    expect(groups.declining).toEqual([]);
  });

  it('returns an entry for every classification key even when empty', () => {
    const groups = groupQueriesByClassification([]);

    expect(Object.keys(groups).sort()).toEqual(
      ['declining', 'gaining_position', 'high_impression_low_ctr', 'losing_position', 'near_page_one', 'rising'].sort(),
    );
  });
});
