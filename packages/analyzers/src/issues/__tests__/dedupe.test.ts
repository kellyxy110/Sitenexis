import { describe, it, expect } from 'vitest';
import { dedupeExact, collapseCanonicalTopics, dedupeFindings, type DedupeInput } from '../dedupe';

function finding(overrides: Partial<DedupeInput> & { id?: string }): DedupeInput & { id?: string } {
  return {
    module: 'seo',
    type: 'title_too_long',
    severity: 'warning',
    message: 'Title is 101 chars (max 70)',
    recommendation: 'Shorten the title to under 70 characters.',
    pageUrl: null,
    ...overrides,
  };
}

describe('dedupeExact — same analyzer, multiple pages', () => {
  it('merges the same title-length finding across three different pages into one group', () => {
    const items = [
      finding({ id: '1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      finding({ id: '2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
      finding({ id: '3', pageUrl: 'https://x.com/c', message: 'Title is 79 chars (max 70)' }),
    ];

    const groups = dedupeExact(items);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.affectedPageCount).toBe(3);
    expect(groups[0]!.affectedUrls.sort()).toEqual(['https://x.com/a', 'https://x.com/b', 'https://x.com/c']);
  });

  it('preserves every member (per-page evidence) inside the group — grouping never discards it', () => {
    const items = [
      finding({ id: '1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      finding({ id: '2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
    ];

    const groups = dedupeExact(items);

    expect(groups[0]!.members).toHaveLength(2);
    expect(groups[0]!.members.map((m) => m.message)).toEqual([
      'Title is 101 chars (max 70)',
      'Title is 89 chars (max 70)',
    ]);
  });

  it('keeps the most severe item as the representative when duplicates disagree on severity', () => {
    const items = [
      finding({ id: '1', severity: 'info', pageUrl: 'https://x.com/a' }),
      finding({ id: '2', severity: 'critical', pageUrl: 'https://x.com/b' }),
      finding({ id: '3', severity: 'warning', pageUrl: 'https://x.com/c' }),
    ];

    const groups = dedupeExact(items);

    expect(groups).toHaveLength(1);
    expect(groups[0]!.representative.severity).toBe('critical');
  });

  it('does not merge findings of the same type but a genuinely different recommendation', () => {
    const items = [
      finding({ id: '1', type: 'missing_h1', message: 'No <h1> tag found', recommendation: 'Add a single H1 that describes the page topic.' }),
      finding({ id: '2', type: 'missing_h1', message: 'No H1 was detected in the static HTML response. The page may render its primary heading with JavaScript.', recommendation: 'Confirm with browser rendering whether an H1 is present; add server-rendered output if the site relies on client-side rendering.' }),
    ];

    const groups = dedupeExact(items);

    // Different confidence/wording reflects a genuinely different claim (confirmed vs.
    // uncertain) — these must not be silently collapsed into one finding.
    expect(groups).toHaveLength(2);
  });

  it('does not merge findings from different modules even with the same type name', () => {
    const items = [
      finding({ id: '1', module: 'seo', type: 'thin_content' }),
      finding({ id: '2', module: 'performance', type: 'thin_content', recommendation: 'Reduce main-thread blocking time.' }),
    ];

    const groups = dedupeExact(items);

    expect(groups).toHaveLength(2);
  });

  it('reports a single-page finding with affectedPageCount 1', () => {
    const items = [finding({ id: '1', pageUrl: 'https://x.com/a' })];

    const groups = dedupeExact(items);

    expect(groups[0]!.affectedPageCount).toBe(1);
  });
});

describe('collapseCanonicalTopics — same real-world fix from different analyzers', () => {
  it('merges "add sameAs links" raised by both Entity and Machine Trust modules', () => {
    const groups = dedupeExact([
      finding({
        id: 'entity-1', module: 'entity', type: 'disambiguation_failure',
        message: 'Very few entities have sameAs links to external knowledge sources.',
        recommendation: 'Add schema markup with sameAs links to Wikipedia, Wikidata, LinkedIn, or other authoritative sources.',
      }),
      finding({
        id: 'trust-1', module: 'machine-trust', type: 'missing_same_as', severity: 'critical',
        message: 'No sameAs links detected.',
        recommendation: 'Add sameAs links to Wikipedia, Wikidata, or other authoritative sources in Organization schema.',
      }),
    ]);

    const merged = collapseCanonicalTopics(groups);

    expect(merged).toHaveLength(1);
    expect(merged[0]!.representative.severity).toBe('critical');
    expect(merged[0]!.mergedModules).toContain('entity');
  });

  it('does not merge an unrelated finding that only shares a keyword', () => {
    const groups = dedupeExact([
      finding({
        id: 'entity-1', module: 'entity', type: 'disambiguation_failure',
        message: 'Short generic entity names detected.',
        recommendation: 'Rename ambiguous entities to more specific, unique names.',
      }),
      finding({
        id: 'trust-1', module: 'machine-trust', type: 'missing_same_as',
        message: 'No sameAs links detected.',
        recommendation: 'Add sameAs links to Wikipedia, Wikidata, or other authoritative sources.',
      }),
    ]);

    const merged = collapseCanonicalTopics(groups);

    expect(merged).toHaveLength(2);
  });
});

describe('dedupeFindings — full pipeline', () => {
  it('runs exact-match then canonical-topic passes together', () => {
    const items = [
      finding({ id: '1', pageUrl: 'https://x.com/a', message: 'Title is 101 chars (max 70)' }),
      finding({ id: '2', pageUrl: 'https://x.com/b', message: 'Title is 89 chars (max 70)' }),
      finding({
        id: 'entity-1', module: 'entity', type: 'disambiguation_failure',
        message: 'Very few entities have sameAs links.',
        recommendation: 'Add schema markup with sameAs links to Wikipedia, Wikidata, LinkedIn, or other authoritative sources.',
      }),
      finding({
        id: 'trust-1', module: 'machine-trust', type: 'missing_same_as',
        message: 'No sameAs links detected.',
        recommendation: 'Add sameAs links to Wikipedia, Wikidata, or other authoritative sources.',
      }),
    ];

    const groups = dedupeFindings(items);

    expect(groups).toHaveLength(2);
    const titleGroup = groups.find((g) => g.representative.type === 'title_too_long')!;
    expect(titleGroup.affectedPageCount).toBe(2);
    const sameAsGroup = groups.find((g) => /same\s*as/i.test(g.representative.recommendation))!;
    expect(sameAsGroup.mergedModules.length).toBeGreaterThan(0);
  });
});
