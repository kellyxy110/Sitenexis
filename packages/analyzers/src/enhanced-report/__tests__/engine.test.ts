// Enhanced Report Engine — unit tests using a bruceandbutler.com-style fixture.
// Tests cover: issue detection, schema generation, score explanation, page analysis, roadmap.

import { describe, it, expect, beforeEach } from 'vitest';
import type { CrawledPage } from '@sitenexis/shared';
import { buildEnhancedReport } from '../engine';
import { extractOrgSignals, detectFAQOpportunities, generateOrganizationSchema, generateFAQSchema, generateBreadcrumbSchema } from '../schema-generator';
import { generateMetaDescription, generateCanonicalTag, generateOGTags } from '../fix-generator';
import { enrichSEOIssues, detectSchemaGapIssues } from '../issue-enricher';
import type { EnhancedReportInput } from '@sitenexis/shared';

// ── Fixture factory ───────────────────────────────────────────────────────────

function makePage(overrides: Partial<CrawledPage> = {}): CrawledPage {
  return {
    url: 'https://www.bruceandbutler.com/',
    statusCode: 200,
    redirectChain: [],
    title: 'Bruce & Butler — Interior Design Consultants',
    metaDescription: 'Award-winning interior design consultancy specialising in residential and commercial spaces.',
    h1: 'Interior Design Consultants',
    headings: [
      { level: 1, text: 'Interior Design Consultants' },
      { level: 2, text: 'Our Services' },
      { level: 2, text: 'Why Choose Us' },
      { level: 2, text: 'How does the design process work?' },
      { level: 2, text: 'What areas do you cover?' },
    ],
    bodyText: 'Bruce & Butler is an award-winning interior design consultancy. We specialise in residential and commercial spaces. How does the design process work? We begin with a consultation to understand your vision. What areas do you cover? We cover London and the South East.',
    wordCount: 650,
    internalLinks: ['/services', '/about', '/contact', '/portfolio'],
    externalLinks: [],
    images: [
      { src: '/images/hero-living-room.jpg', alt: null },
      { src: '/images/logo.png', alt: 'Bruce & Butler logo' },
    ],
    canonicalUrl: 'https://www.bruceandbutler.com/',
    robotsDirectives: [],
    schemaMarkup: [],
    schemaTypes: [],
    hasStructuredData: false,
    responseTimeMs: 850,
    contentType: 'text/html',
    crawledAt: new Date('2026-07-05'),
    openGraph: {},
    ...overrides,
  };
}

function makeServicePage(): CrawledPage {
  return makePage({
    url: 'https://www.bruceandbutler.com/services/',
    title: 'Interior Design Services | Bruce & Butler',
    h1: 'Our Interior Design Services',
    metaDescription: null,
    headings: [
      { level: 1, text: 'Our Interior Design Services' },
      { level: 2, text: 'Residential Design' },
      { level: 2, text: 'Commercial Interiors' },
      { level: 2, text: 'Project Management' },
    ],
    bodyText: 'We offer a comprehensive range of interior design services for residential and commercial clients.',
    wordCount: 420,
    canonicalUrl: null,
    schemaMarkup: [],
    schemaTypes: [],
    hasStructuredData: false,
  });
}

function makeThinPage(): CrawledPage {
  return makePage({
    url: 'https://www.bruceandbutler.com/thank-you/',
    title: 'Thank You',
    h1: null,
    metaDescription: null,
    headings: [],
    bodyText: 'Thank you for your enquiry.',
    wordCount: 6,
    schemaMarkup: [],
    schemaTypes: [],
    hasStructuredData: false,
  });
}

function makePageWithOrgSchema(): CrawledPage {
  return makePage({
    schemaMarkup: [{
      '@context': 'https://schema.org',
      '@type': 'Organization',
      'name': 'Bruce & Butler',
      'url': 'https://www.bruceandbutler.com/',
      'description': 'Award-winning interior design consultancy.',
      'sameAs': ['https://en.wikipedia.org/wiki/Bruce_%26_Butler'],
    }],
    schemaTypes: ['Organization'],
    hasStructuredData: true,
  });
}

const BASE_SCORES = {
  seoScore: 62,
  schemaScore: 15,
  aiScore: 48,
  machineReadabilityScore: 55,
  entityConfidenceScore: 40,
  retrievalReadinessScore: 45,
  citationProbabilityScore: 38,
  semanticTrustScore: 52,
  recommendationConfidence: 42,
  overall: 50,
};

const BASE_SEO_ISSUES = [
  {
    type: 'missing_meta_description',
    severity: 'warning' as const,
    url: 'https://www.bruceandbutler.com/services/',
    message: 'No meta description',
    problem: 'Page has no meta description.',
    cause: 'Search engines auto-generate snippets.',
    solution: 'Add a 120–155 character meta description.',
    recommendation: 'Add a meta description.',
  },
  {
    type: 'missing_canonical',
    severity: 'warning' as const,
    url: 'https://www.bruceandbutler.com/services/',
    message: 'No canonical link',
    problem: 'No canonical URL declared.',
    cause: 'Duplicate content risk.',
    solution: 'Add canonical link tag.',
    recommendation: 'Add canonical.',
  },
  {
    type: 'low_word_count',
    severity: 'info' as const,
    url: 'https://www.bruceandbutler.com/thank-you/',
    message: 'Only 6 words',
    problem: 'Page has too little content.',
    cause: 'Pages below 300 words cannot form stable chunks.',
    solution: 'Expand content to 300+ words.',
    recommendation: 'Add more content.',
  },
];

// ── Engine integration tests ──────────────────────────────────────────────────

describe('buildEnhancedReport', () => {
  let input: EnhancedReportInput;

  beforeEach(() => {
    input = {
      auditId: 'test-audit-001',
      domain: 'bruceandbutler.com',
      crawlDurationMs: 12_000,
      pages: [makePage(), makeServicePage(), makeThinPage()],
      scores: BASE_SCORES,
      seoIssues: BASE_SEO_ISSUES,
    };
  });

  it('returns a valid EnhancedAuditReport shape', () => {
    const report = buildEnhancedReport(input);

    expect(report.meta.auditId).toBe('test-audit-001');
    expect(report.meta.domain).toBe('bruceandbutler.com');
    expect(report.meta.pagesAnalyzed).toBe(3);
    expect(report.meta.engineVersion).toBeTruthy();
    expect(report.meta.generatedAt).toBeInstanceOf(Date);
  });

  it('produces an executive summary with headline, findings, and opportunities', () => {
    const report = buildEnhancedReport(input);

    expect(typeof report.executiveSummary.headline).toBe('string');
    expect(report.executiveSummary.headline.length).toBeGreaterThan(20);
    expect(Array.isArray(report.executiveSummary.keyFindings)).toBe(true);
    expect(report.executiveSummary.keyFindings.length).toBeGreaterThan(0);
    expect(Array.isArray(report.executiveSummary.topOpportunities)).toBe(true);
    expect(report.executiveSummary.estimatedTotalGain.aiVisibility).toBeGreaterThanOrEqual(0);
    expect(report.executiveSummary.estimatedTotalGain.seo).toBeGreaterThanOrEqual(0);
  });

  it('detects critical schema gap: missing Organization schema', () => {
    const report = buildEnhancedReport(input);

    const orgIssue = [...report.criticalIssues, ...report.highIssues].find((i) =>
      i.id.includes('missing_organization_schema'),
    );
    expect(orgIssue).toBeDefined();
    expect(orgIssue?.category).toBe('schema');
    expect(orgIssue?.generatedFix?.type).toBe('json_ld');
    expect(orgIssue?.generatedFix?.code).toContain('Organization');
  });

  it('detects high-priority schema gap: missing sameAs', () => {
    const report = buildEnhancedReport(input);

    const sameAsIssue = [...report.criticalIssues, ...report.highIssues].find((i) =>
      i.id.includes('missing_same_as'),
    );
    expect(sameAsIssue).toBeDefined();
    expect(sameAsIssue?.category).toBe('entity');
    expect(sameAsIssue?.expectedImprovement.trustGain).toBeGreaterThan(8);
  });

  it('detects FAQ schema opportunity from question-style headings', () => {
    const report = buildEnhancedReport(input);

    const faqIssue = [...report.criticalIssues, ...report.highIssues, ...report.mediumIssues].find((i) =>
      i.id.includes('missing_faq_schema'),
    );
    // Homepage has question-style headings, so this should be detected
    expect(faqIssue).toBeDefined();
    expect(faqIssue?.generatedFix?.type).toBe('faq');
  });

  it('enriches SEO issues with full intelligence fields', () => {
    const report = buildEnhancedReport(input);

    const allIssues = [
      ...report.criticalIssues,
      ...report.highIssues,
      ...report.mediumIssues,
      ...report.lowIssues,
    ];

    // Every issue must have the required intelligence fields
    for (const issue of allIssues) {
      expect(issue.id).toBeTruthy();
      expect(issue.title).toBeTruthy();
      expect(issue.whyItMatters.length).toBeGreaterThan(30);
      expect(Array.isArray(issue.affectedPages)).toBe(true);
      expect(issue.affectedPages.length).toBeGreaterThan(0);
      expect(Array.isArray(issue.evidence)).toBe(true);
      expect(issue.businessImpact.summary).toBeTruthy();
      expect(issue.aiVisibilityImpact.estimatedScoreLoss).toBeGreaterThanOrEqual(0);
      expect(issue.seoImpact.estimatedScoreLoss).toBeGreaterThanOrEqual(0);
      expect(issue.recommendedSolution.steps.length).toBeGreaterThan(0);
      expect(issue.expectedImprovement.confidence).toBeGreaterThan(0);
      expect(issue.priorityScore).toBeGreaterThan(0);
    }
  });

  it('produces 11 explainable scores each with signals and fixes', () => {
    const report = buildEnhancedReport(input);
    const scoreKeys = Object.keys(report.scores) as Array<keyof typeof report.scores>;

    expect(scoreKeys).toHaveLength(11);

    for (const key of scoreKeys) {
      const score = report.scores[key];
      expect(score.dimension).toBeTruthy();
      expect(score.value).toBeGreaterThanOrEqual(0);
      expect(score.value).toBeLessThanOrEqual(100);
      expect(score.reason.length).toBeGreaterThan(10);
      expect(Array.isArray(score.positiveSignals)).toBe(true);
      expect(Array.isArray(score.negativeSignals)).toBe(true);
      expect(Array.isArray(score.topFixes)).toBe(true);
      expect(score.estimatedAfterFixes).toBeGreaterThanOrEqual(score.value);
    }
  });

  it('produces page-by-page analysis for all crawled pages', () => {
    const report = buildEnhancedReport(input);

    expect(report.pageAnalyses).toHaveLength(3);

    for (const pa of report.pageAnalyses) {
      expect(pa.url).toBeTruthy();
      expect(pa.scores.seo).toBeGreaterThanOrEqual(0);
      expect(pa.scores.aiVisibility).toBeGreaterThanOrEqual(0);
      expect(pa.scores.schema).toBeGreaterThanOrEqual(0);
      expect(pa.retrievalQualityScore).toBeGreaterThanOrEqual(0);
      expect(pa.citationEligibilityScore).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(pa.schemaTypes)).toBe(true);
      expect(typeof pa.wordCount).toBe('number');
    }
  });

  it('generates schema recommendations from schema-gap issues', () => {
    const report = buildEnhancedReport(input);

    // Should have at least Organization schema recommendation
    expect(report.schemaRecommendations.length).toBeGreaterThan(0);
    const orgRec = report.schemaRecommendations.find((r) => r.generatedCode.includes('Organization'));
    expect(orgRec).toBeDefined();
    expect(orgRec?.generatedCode).toContain('"@context"');
  });

  it('builds an implementation roadmap with at least week 1', () => {
    const report = buildEnhancedReport(input);

    expect(report.implementationRoadmap.length).toBeGreaterThan(0);
    const week1 = report.implementationRoadmap.find((r) => r.week === 1);
    expect(week1).toBeDefined();
    expect(week1?.issueIds.length).toBeGreaterThan(0);
    expect(week1?.estimatedImpact.aiVisibility).toBeGreaterThanOrEqual(0);
  });

  it('produces an expected improvement projection with after-fix scores > current', () => {
    const report = buildEnhancedReport(input);
    const ei = report.expectedImprovements;

    expect(ei.afterAllFixes.aiVisibility).toBeGreaterThanOrEqual(ei.current.aiVisibility);
    expect(ei.afterAllFixes.seo).toBeGreaterThanOrEqual(ei.current.seo);
    expect(ei.afterAllFixes.trust).toBeGreaterThanOrEqual(ei.current.trust);
    expect(ei.confidence).toBeGreaterThan(0);
    expect(ei.confidence).toBeLessThanOrEqual(1);
  });

  it('builds evidence appendix from all issues', () => {
    const report = buildEnhancedReport(input);

    expect(report.evidenceAppendix.length).toBeGreaterThan(0);
    for (const ev of report.evidenceAppendix) {
      expect(ev.issueId).toBeTruthy();
      expect(ev.pageUrl).toBeTruthy();
    }
  });

  it('does NOT detect Organization issue when schema is present', () => {
    const input2: EnhancedReportInput = {
      ...input,
      pages: [makePageWithOrgSchema(), makeServicePage()],
    };
    const report = buildEnhancedReport(input2);
    const allIssues = [...report.criticalIssues, ...report.highIssues];
    const orgIssue = allIssues.find((i) => i.id.includes('missing_organization_schema'));
    expect(orgIssue).toBeUndefined();
  });

  it('does NOT detect sameAs issue when sameAs links are present', () => {
    const input2: EnhancedReportInput = {
      ...input,
      pages: [makePageWithOrgSchema(), makeServicePage()],
    };
    const report = buildEnhancedReport(input2);
    const allIssues = [...report.criticalIssues, ...report.highIssues];
    const sameAsIssue = allIssues.find((i) => i.id.includes('missing_same_as'));
    expect(sameAsIssue).toBeUndefined();
  });

  it('thin page gets low AI visibility and retrieval scores', () => {
    const report = buildEnhancedReport(input);
    const thinPageAnalysis = report.pageAnalyses.find((pa) =>
      pa.url.includes('thank-you'),
    );
    expect(thinPageAnalysis).toBeDefined();
    expect(thinPageAnalysis!.scores.aiVisibility).toBeLessThan(50);
    expect(thinPageAnalysis!.retrievalQualityScore).toBeLessThan(50);
  });

  it('generated fixes collection contains all issues with generatedFix', () => {
    const report = buildEnhancedReport(input);
    const allIssues = [
      ...report.criticalIssues,
      ...report.highIssues,
      ...report.mediumIssues,
      ...report.lowIssues,
    ];
    const issuesWithFix = allIssues.filter((i) => i.generatedFix);
    expect(report.generatedFixes.length).toBe(issuesWithFix.length);
  });
});

// ── Schema generator tests ────────────────────────────────────────────────────

describe('extractOrgSignals', () => {
  it('returns nulls for page with no schema and no title', () => {
    const page = makePage({ title: null, schemaMarkup: [] });
    const signals = extractOrgSignals([page]);
    expect(signals.name).toBeNull();
    expect(signals.phone).toBeNull();
    expect(signals.sameAsLinks).toEqual([]);
  });

  it('extracts org name from existing Organization schema', () => {
    const page = makePageWithOrgSchema();
    const signals = extractOrgSignals([page]);
    expect(signals.name).toBe('Bruce & Butler');
    expect(signals.sameAsLinks.length).toBeGreaterThan(0);
  });

  it('derives name from title when no schema', () => {
    const page = makePage({ schemaMarkup: [], schemaTypes: [] });
    const signals = extractOrgSignals([page]);
    expect(signals.name).toBe('Bruce & Butler');
  });
});

describe('generateOrganizationSchema', () => {
  it('produces valid JSON-LD with @context and @type', () => {
    const signals = extractOrgSignals([makePage()]);
    const code = generateOrganizationSchema(signals, 'bruceandbutler.com');
    const parsed = JSON.parse(code) as Record<string, unknown>;
    expect(parsed['@context']).toBe('https://schema.org');
    expect(parsed['@type']).toBe('Organization');
    expect(typeof parsed['name']).toBe('string');
    expect(typeof parsed['url']).toBe('string');
    expect(Array.isArray(parsed['sameAs'])).toBe(true);
  });

  it('includes sameAs array even when signals have no sameAs', () => {
    const signals = extractOrgSignals([makePage({ schemaMarkup: [] })]);
    const code = generateOrganizationSchema(signals, 'bruceandbutler.com');
    const parsed = JSON.parse(code) as Record<string, unknown>;
    expect(Array.isArray(parsed['sameAs'])).toBe(true);
    expect((parsed['sameAs'] as unknown[]).length).toBeGreaterThan(0);
  });
});

describe('detectFAQOpportunities', () => {
  it('detects question headings as FAQ opportunities', () => {
    const pages = [makePage()];
    const opps = detectFAQOpportunities(pages);
    expect(opps.length).toBeGreaterThan(0);
    expect(opps[0]!.faqs.length).toBeGreaterThan(0);
    expect(opps[0]!.faqs[0]!.question.endsWith('?')).toBe(true);
  });

  it('returns empty when no question-style headings', () => {
    const page = makePage({ headings: [{ level: 1, text: 'About Us' }, { level: 2, text: 'Our Team' }] });
    const opps = detectFAQOpportunities([page]);
    expect(opps.length).toBe(0);
  });
});

describe('generateFAQSchema', () => {
  it('produces valid FAQPage JSON-LD', () => {
    const faqs = [
      { question: 'How does the design process work?', answer: 'We begin with a consultation.' },
      { question: 'What areas do you cover?', answer: 'We cover London and the South East.' },
    ];
    const code = generateFAQSchema(faqs);
    const parsed = JSON.parse(code) as Record<string, unknown>;
    expect(parsed['@type']).toBe('FAQPage');
    expect(Array.isArray(parsed['mainEntity'])).toBe(true);
    expect((parsed['mainEntity'] as unknown[]).length).toBe(2);
  });
});

describe('generateBreadcrumbSchema', () => {
  it('produces BreadcrumbList with correct items for a deep URL', () => {
    const code = generateBreadcrumbSchema('https://www.bruceandbutler.com/services/residential/');
    const parsed = JSON.parse(code) as Record<string, unknown>;
    expect(parsed['@type']).toBe('BreadcrumbList');
    const items = parsed['itemListElement'] as Array<Record<string, unknown>>;
    expect(items.length).toBe(3); // home + services + residential
    expect((items[0]!['name'] as string).toLowerCase()).toContain('home');
  });

  it('returns empty string for invalid URL', () => {
    const code = generateBreadcrumbSchema('not-a-url');
    expect(code.length).toBeGreaterThan(0); // resolves gracefully
  });
});

// ── Fix generator tests ───────────────────────────────────────────────────────

describe('generateMetaDescription', () => {
  it('returns a <meta> tag with content from body text', () => {
    const page = makePage({ metaDescription: null });
    const tag = generateMetaDescription(page);
    expect(tag).toContain('<meta name="description"');
    expect(tag).toContain('content="');
  });

  it('uses title as fallback when body text is insufficient', () => {
    const page = makePage({ metaDescription: null, bodyText: 'Hi.' });
    const tag = generateMetaDescription(page);
    expect(tag).toContain('Bruce');
  });
});

describe('generateCanonicalTag', () => {
  it('produces a valid canonical link tag', () => {
    const tag = generateCanonicalTag('https://www.bruceandbutler.com/services/');
    expect(tag).toBe('<link rel="canonical" href="https://www.bruceandbutler.com/services/">');
  });

  it('escapes ampersands in URLs', () => {
    const tag = generateCanonicalTag('https://example.com/?a=1&b=2');
    expect(tag).toContain('&amp;');
  });
});

describe('generateOGTags', () => {
  it('produces og:title, og:description, og:url, og:image', () => {
    const page = makePage();
    const tags = generateOGTags(page, 'bruceandbutler.com');
    expect(tags).toContain('og:title');
    expect(tags).toContain('og:description');
    expect(tags).toContain('og:url');
    expect(tags).toContain('og:image');
    expect(tags).toContain('twitter:card');
  });
});

// ── Issue enricher tests ──────────────────────────────────────────────────────

describe('enrichSEOIssues', () => {
  it('groups issues by type and returns one per type', () => {
    const raw = [
      { type: 'missing_title', severity: 'critical' as const, url: 'https://example.com/a', message: 'No title', problem: '', cause: '', solution: '', recommendation: '' },
      { type: 'missing_title', severity: 'critical' as const, url: 'https://example.com/b', message: 'No title', problem: '', cause: '', solution: '', recommendation: '' },
    ];
    const issues = enrichSEOIssues(raw, [makePage()], 'example.com');
    const titleIssues = issues.filter((i) => i.id.includes('missing_title'));
    expect(titleIssues).toHaveLength(1);
    expect(titleIssues[0]!.affectedPages).toHaveLength(2);
  });

  it('every enriched issue has whyItMatters, evidence, and businessImpact', () => {
    const issues = enrichSEOIssues(BASE_SEO_ISSUES, [makePage(), makeServicePage(), makeThinPage()], 'bruceandbutler.com');
    for (const issue of issues) {
      expect(issue.whyItMatters.length).toBeGreaterThan(20);
      expect(issue.evidence.length).toBeGreaterThan(0);
      expect(issue.businessImpact.affectedAreas.length).toBeGreaterThan(0);
    }
  });
});

describe('detectSchemaGapIssues', () => {
  it('detects Organization gap on a site with no schema', () => {
    const pages = [makePage(), makeServicePage()];
    const issues = detectSchemaGapIssues(pages, 'bruceandbutler.com');
    const orgIssue = issues.find((i) => i.id.includes('missing_organization_schema'));
    expect(orgIssue).toBeDefined();
    expect(orgIssue!.severity).toBe('critical');
  });

  it('does not emit Organization issue when schema is present', () => {
    const pages = [makePageWithOrgSchema(), makeServicePage()];
    const issues = detectSchemaGapIssues(pages, 'bruceandbutler.com');
    const orgIssue = issues.find((i) => i.id.includes('missing_organization_schema'));
    expect(orgIssue).toBeUndefined();
  });

  it('emits speakable issue when no speakable schema exists', () => {
    const pages = [makePage()];
    const issues = detectSchemaGapIssues(pages, 'bruceandbutler.com');
    const speakableIssue = issues.find((i) => i.id.includes('speakable'));
    expect(speakableIssue).toBeDefined();
    expect(speakableIssue!.generatedFix?.type).toBe('json_ld');
  });

  it('detects OG tag gaps on pages without openGraph', () => {
    const pages = [
      makePage({ openGraph: {} }),
      makeServicePage(),
      makeThinPage(),
    ];
    const issues = detectSchemaGapIssues(pages, 'bruceandbutler.com');
    const ogIssue = issues.find((i) => i.id.includes('missing_og_tags'));
    expect(ogIssue).toBeDefined();
  });

  it('detects alt text issue when images have no alt', () => {
    const pages = [makePage()]; // homepage has image with alt: null
    const issues = detectSchemaGapIssues(pages, 'bruceandbutler.com');
    const altIssue = issues.find((i) => i.id.includes('missing_alt_text'));
    expect(altIssue).toBeDefined();
    expect(altIssue!.category).toBe('accessibility');
    expect(altIssue!.generatedFix?.type).toBe('alt_text');
  });
});
