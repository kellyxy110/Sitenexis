import { describe, it, expect } from 'vitest';
import { analyzeSEO } from '../analyzer';
import { calculateSEOScore, getSEOScoreLabel, getSEOScoreColor } from '../scoring';
import { type CrawledPage } from '@sitenexis/shared';

// ─── Fixture ──────────────────────────────────────────────────────────────────

const basePage: CrawledPage = {
  url: 'https://example.com',
  statusCode: 200,
  redirectChain: [],
  title: 'Example Page — A Well Optimised Title Tag',
  metaDescription: 'A concise and informative meta description for this example page that is over one hundred characters.',
  h1: 'Example H1 Heading',
  headings: [{ level: 1, text: 'Example H1 Heading' }],
  bodyText: 'Word '.repeat(400),
  wordCount: 400,
  internalLinks: ['https://example.com/about'],
  externalLinks: [],
  images: [],
  canonicalUrl: 'https://example.com',
  robotsDirectives: [],
  schemaMarkup: [],
  responseTimeMs: 320,
  contentType: 'text/html',
  crawledAt: new Date(),
};

function page(overrides: Partial<CrawledPage>): CrawledPage {
  return { ...basePage, ...overrides };
}

// ─── Title checks ─────────────────────────────────────────────────────────────

describe('Title checks', () => {
  it('returns no issues for a well-optimised page', () => {
    const { issues } = analyzeSEO([basePage]);
    expect(issues).toHaveLength(0);
  });

  it('flags missing title as critical', () => {
    const { issues } = analyzeSEO([page({ title: null })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_title', severity: 'critical' }));
  });

  it('flags title under 30 chars as warning', () => {
    const { issues } = analyzeSEO([page({ title: 'Short' })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'title_too_short', severity: 'warning' }));
  });

  it('flags title over 60 chars as warning', () => {
    const { issues } = analyzeSEO([page({ title: 'A'.repeat(65) })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'title_too_long', severity: 'warning' }));
  });

  it('flags duplicate titles across pages', () => {
    const pages = [
      page({ url: 'https://example.com/a' }),
      page({ url: 'https://example.com/b' }),
    ];
    const { issues } = analyzeSEO(pages);
    const dupes = issues.filter((i) => i.type === 'duplicate_title');
    expect(dupes).toHaveLength(2);
    expect(dupes.every((i) => i.severity === 'warning')).toBe(true);
  });

  it('flags title identical to H1 as info', () => {
    const { issues } = analyzeSEO([
      page({ title: 'Exact Match Heading', h1: 'Exact Match Heading' }),
    ]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'duplicate_title', severity: 'info' }));
  });
});

// ─── Meta description checks ──────────────────────────────────────────────────

describe('Meta description checks', () => {
  it('flags missing meta description as warning', () => {
    const { issues } = analyzeSEO([page({ metaDescription: null })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_meta_description', severity: 'warning' }));
  });

  it('flags meta description under 100 chars as warning', () => {
    const { issues } = analyzeSEO([page({ metaDescription: 'Too short.' })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_meta_description', severity: 'warning' }));
  });

  it('flags meta description over 160 chars as warning', () => {
    const { issues } = analyzeSEO([page({ metaDescription: 'A'.repeat(165) })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'meta_description_too_long', severity: 'warning' }));
  });

  it('flags duplicate meta descriptions across pages', () => {
    const pages = [
      page({ url: 'https://example.com/a' }),
      page({ url: 'https://example.com/b' }),
    ];
    const { issues } = analyzeSEO(pages);
    const dupes = issues.filter((i) => i.type === 'duplicate_meta_description');
    expect(dupes).toHaveLength(2);
  });
});

// ─── Canonical checks ─────────────────────────────────────────────────────────

describe('Canonical checks', () => {
  it('flags missing canonical as warning', () => {
    const { issues } = analyzeSEO([page({ canonicalUrl: null })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_canonical', severity: 'warning' }));
  });

  it('flags canonical pointing to a different domain as critical', () => {
    const { issues } = analyzeSEO([page({ canonicalUrl: 'https://other-domain.com/' })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'broken_canonical', severity: 'critical' }));
  });

  it('does not flag a correct self-referencing canonical', () => {
    const { issues } = analyzeSEO([page({ url: 'https://example.com/about', canonicalUrl: 'https://example.com/about' })]);
    expect(issues.filter((i) => i.type === 'broken_canonical')).toHaveLength(0);
  });

  it('flags a canonical chain as warning', () => {
    const pages = [
      page({ url: 'https://example.com/a', canonicalUrl: 'https://example.com/b' }),
      page({ url: 'https://example.com/b', canonicalUrl: 'https://example.com/c' }),
      page({ url: 'https://example.com/c', canonicalUrl: 'https://example.com/c' }),
    ];
    const { issues } = analyzeSEO(pages);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'broken_canonical', severity: 'warning', url: 'https://example.com/a' })
    );
  });
});

// ─── Robots / indexability checks ─────────────────────────────────────────────

describe('Robots / indexability checks', () => {
  it('flags noindex page with inbound internal links as warning', () => {
    const pages = [
      page({ url: 'https://example.com/private', robotsDirectives: ['noindex'] }),
      page({ url: 'https://example.com', internalLinks: ['https://example.com/private'] }),
    ];
    const { issues } = analyzeSEO(pages);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'noindex_page', severity: 'warning', url: 'https://example.com/private' })
    );
  });

  it('flags noindex page present in sitemap as critical', () => {
    const { issues } = analyzeSEO(
      [page({ url: 'https://example.com/blocked', robotsDirectives: ['noindex'] })],
      ['https://example.com/blocked']
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'noindex_page', severity: 'critical' })
    );
  });

  it('flags 4xx page as critical', () => {
    const { issues } = analyzeSEO([page({ statusCode: 404 })]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'broken_internal_link', severity: 'critical' }));
  });

  it('flags redirect chain over 2 hops as warning', () => {
    const { issues } = analyzeSEO([
      page({ redirectChain: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'] }),
    ]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'redirect_chain', severity: 'warning' }));
  });
});

// ─── Sitemap checks ───────────────────────────────────────────────────────────

describe('Sitemap checks', () => {
  it('flags missing sitemap as warning when no sitemap URLs provided', () => {
    const { issues } = analyzeSEO([basePage], []);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_sitemap', severity: 'warning' }));
  });

  it('flags page in crawl but not in sitemap as warning', () => {
    const { issues } = analyzeSEO(
      [basePage, page({ url: 'https://example.com/unlisted' })],
      ['https://example.com'] // only homepage in sitemap
    );
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'missing_sitemap', url: 'https://example.com/unlisted' })
    );
  });

  it('flags sitemap URL returning non-200 as critical', () => {
    const pages = [
      basePage,
      page({ url: 'https://example.com/gone', statusCode: 410 }),
    ];
    const { issues } = analyzeSEO(pages, ['https://example.com', 'https://example.com/gone']);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'broken_internal_link', severity: 'critical', url: 'https://example.com/gone' })
    );
  });
});

// ─── Internal links ───────────────────────────────────────────────────────────

describe('Internal link checks', () => {
  it('flags broken internal links (destination 4xx) as critical', () => {
    const pages = [
      page({ internalLinks: ['https://example.com/missing'] }),
      page({ url: 'https://example.com/missing', statusCode: 404 }),
    ];
    const { issues } = analyzeSEO(pages);
    expect(issues).toContainEqual(
      expect.objectContaining({ type: 'broken_internal_link', severity: 'critical' })
    );
  });

  it('flags images without alt text as warning', () => {
    const { issues } = analyzeSEO([
      page({ images: [{ src: 'img.jpg', alt: null }, { src: 'img2.jpg', alt: '' }] }),
    ]);
    expect(issues).toContainEqual(expect.objectContaining({ type: 'missing_alt_text', severity: 'warning' }));
  });
});

// ─── Deduplication + sorting ──────────────────────────────────────────────────

describe('Issue deduplication and sorting', () => {
  it('deduplicates identical issues', () => {
    const pageWithBothIssues = page({ title: null, metaDescription: null });
    const { issues } = analyzeSEO([pageWithBothIssues, pageWithBothIssues]);
    const missingTitles = issues.filter((i) => i.type === 'missing_title' && i.url === pageWithBothIssues.url);
    expect(missingTitles).toHaveLength(1);
  });

  it('sorts critical issues before warnings before info', () => {
    const pages = [
      page({ title: null }),              // critical
      page({ url: 'https://example.com/b', canonicalUrl: null }),  // warning
    ];
    const { issues } = analyzeSEO(pages, ['https://example.com', 'https://example.com/b']);
    const severities = issues.map((i) => i.severity);
    const criticalEnd = severities.lastIndexOf('critical');
    const warningStart = severities.indexOf('warning');
    expect(criticalEnd).toBeLessThan(warningStart === -1 ? Infinity : warningStart + 1);
  });
});

// ─── Scoring ──────────────────────────────────────────────────────────────────

describe('calculateSEOScore', () => {
  it('returns 100 for zero issues with all bonuses', () => {
    const { score } = calculateSEOScore([], 10, { hasValidSitemap: true });
    expect(score).toBe(100);
  });

  it('deducts more for critical issues than warnings', () => {
    const criticalIssues = [{ type: 'missing_title' as const, severity: 'critical' as const, url: '/', message: '', recommendation: '' }];
    const warningIssues = [{ type: 'title_too_long' as const, severity: 'warning' as const, url: '/', message: '', recommendation: '' }];
    const critScore = calculateSEOScore(criticalIssues, 1).score;
    const warnScore = calculateSEOScore(warningIssues, 1).score;
    expect(critScore).toBeLessThan(warnScore);
  });

  it('caps score at 0 for extreme issue counts', () => {
    const issues = Array.from({ length: 50 }, (_, i) => ({
      type: 'broken_internal_link' as const,
      severity: 'critical' as const,
      url: `https://example.com/page-${i}`,
      message: 'broken',
      recommendation: 'fix it',
    }));
    const { score } = calculateSEOScore(issues, 1);
    expect(score).toBe(0);
  });

  it('produces a scoreBreakdown with 6 named categories', () => {
    const { breakdown } = calculateSEOScore([], 5);
    expect(Object.keys(breakdown)).toEqual([
      'titleOptimisation', 'metaOptimisation', 'headingStructure',
      'canonicalisation', 'crawlability', 'imageOptimisation',
    ]);
  });

  it('applies sitemap bonus only when context.hasValidSitemap = true', () => {
    const scoreWith = calculateSEOScore([], 5, { hasValidSitemap: true }).score;
    const scoreWithout = calculateSEOScore([], 5, { hasValidSitemap: false }).score;
    expect(scoreWith).toBeGreaterThan(scoreWithout);
  });
});

// ─── getSEOScoreLabel ─────────────────────────────────────────────────────────

describe('getSEOScoreLabel', () => {
  it('returns Excellent for 90+', () => expect(getSEOScoreLabel(95)).toBe('Excellent'));
  it('returns Good for 70–89', () => expect(getSEOScoreLabel(75)).toBe('Good'));
  it('returns Needs Work for 50–69', () => expect(getSEOScoreLabel(55)).toBe('Needs Work'));
  it('returns Critical Issues for <50', () => expect(getSEOScoreLabel(30)).toBe('Critical Issues'));
});

// ─── getSEOScoreColor ─────────────────────────────────────────────────────────

describe('getSEOScoreColor', () => {
  it('returns green hex for 90+', () => expect(getSEOScoreColor(92)).toBe('#22C55E'));
  it('returns teal hex for 70–89', () => expect(getSEOScoreColor(80)).toBe('#0BCEBC'));
  it('returns amber hex for 50–69', () => expect(getSEOScoreColor(60)).toBe('#F59E0B'));
  it('returns red hex for <50', () => expect(getSEOScoreColor(20)).toBe('#EF4444'));
});
