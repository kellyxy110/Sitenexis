import { describe, it, expect } from 'vitest';
import { analyseSEO, type ParsedPage } from '../serverless-audit';

function page(overrides: Partial<ParsedPage> & { url: string }): ParsedPage {
  return {
    statusCode: 200,
    redirectChain: [],
    title: 'A Perfectly Fine Page Title',
    metaDescription: 'A perfectly fine meta description that is long enough to pass validation checks.',
    h1: 'A Perfectly Fine Heading',
    headings: [{ level: 1, text: 'A Perfectly Fine Heading' }],
    bodyText: 'x'.repeat(500),
    wordCount: 500,
    internalLinks: [],
    externalLinks: [],
    images: [],
    canonicalUrl: 'https://x.com/',
    robotsDirectives: [],
    schemaMarkup: [],
    responseTimeMs: 100,
    contentType: 'text/html',
    crawledAt: new Date(),
    canonical: 'https://x.com/',
    robotsMeta: null,
    schemas: [],
    schemaTypes: [],
    hasStructuredData: false,
    ...overrides,
  };
}

describe('analyseSEO — missing H1, confident vs. uncertain evidence', () => {
  it('reports a confirmed critical missing_h1 with full penalty on a normal (complete) extraction', () => {
    const pages = [page({ url: 'https://x.com/', h1: null, headings: [], extractionIncomplete: false })];

    const { issues } = analyseSEO(pages);
    const h1Issue = issues.find((i) => i.type === 'missing_h1')!;

    expect(h1Issue.severity).toBe('critical');
    expect(h1Issue.message).toBe('No <h1> tag found');
    expect(h1Issue.confidence).toBe('high');
  });

  it('reports missing_h1 as a lower-severity, qualified, low-confidence finding when extraction was incomplete', () => {
    const pages = [page({ url: 'https://x.com/', h1: null, headings: [], extractionIncomplete: true })];

    const { issues } = analyseSEO(pages);
    const h1Issue = issues.find((i) => i.type === 'missing_h1')!;

    expect(h1Issue.severity).toBe('warning');
    expect(h1Issue.confidence).toBe('low');
    expect(h1Issue.message).not.toBe('No <h1> tag found');
    expect(h1Issue.message.toLowerCase()).toContain('javascript');
    expect(h1Issue.message.toLowerCase()).not.toContain('this page has no h1');
  });

  it('does not report missing_h1 at all when the page genuinely has an H1', () => {
    const pages = [page({ url: 'https://x.com/' })];

    const { issues } = analyseSEO(pages);

    expect(issues.find((i) => i.type === 'missing_h1')).toBeUndefined();
  });

  it('penalises a confirmed missing H1 more than an uncertain one (limited-penalty policy)', () => {
    const confident = analyseSEO([page({ url: 'https://x.com/', h1: null, headings: [], extractionIncomplete: false })]);
    const uncertain = analyseSEO([page({ url: 'https://y.com/', h1: null, headings: [], extractionIncomplete: true })]);

    // Both start from the same otherwise-clean page, so the SEO score gap is
    // attributable entirely to the reduced deduction for uncertain evidence.
    expect(uncertain.score).toBeGreaterThan(confident.score);
  });
});

describe('analyseSEO — low_word_count, confident vs. uncertain evidence', () => {
  it('reports a confirmed low_word_count with unqualified wording on a complete extraction', () => {
    const pages = [
      page({ url: 'https://x.com/' }), // homepage, index 0, exempt from the check
      page({ url: 'https://x.com/thin', wordCount: 50, extractionIncomplete: false }),
    ];

    const { issues } = analyseSEO(pages);
    const wc = issues.find((i) => i.type === 'low_word_count')!;

    expect(wc.message).toBe('Only 50 words');
    expect(wc.confidence).toBe('high');
  });

  it('qualifies low_word_count wording and confidence when extraction was incomplete', () => {
    const pages = [
      page({ url: 'https://x.com/' }),
      page({ url: 'https://x.com/thin', wordCount: 4, extractionIncomplete: true }),
    ];

    const { issues } = analyseSEO(pages);
    const wc = issues.find((i) => i.type === 'low_word_count')!;

    expect(wc.confidence).toBe('low');
    expect(wc.message.toLowerCase()).toContain('javascript');
  });
});

describe('analyseSEO — page attribution', () => {
  it('carries each issue\'s originating page URL so different pages remain distinguishable', () => {
    const pages = [
      page({ url: 'https://x.com/a', title: 'x'.repeat(101) }),
      page({ url: 'https://x.com/b', title: 'x'.repeat(89) }),
      page({ url: 'https://x.com/c', title: 'x'.repeat(79) }),
    ];

    const { issues } = analyseSEO(pages);
    const titleIssues = issues.filter((i) => i.type === 'title_too_long');

    expect(titleIssues.map((i) => i.url).sort()).toEqual(['https://x.com/a', 'https://x.com/b', 'https://x.com/c']);
    // Each carries its own actual character count — not interchangeable, even
    // though the recommendation text is identical.
    expect(new Set(titleIssues.map((i) => i.message)).size).toBe(3);
  });
});
