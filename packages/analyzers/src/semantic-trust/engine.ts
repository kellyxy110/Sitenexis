import type {
  CrawledPage,
  SemanticTrustScore,
  SemanticTrustIssue,
  EntityIntelligenceReport,
  SchemaScore,
} from '@sitenexis/shared';
import { callAI } from '../ai/client';
import { contradictionDetectionPrompt } from '../ai/prompts';
import { buildCacheKey, getCachedScore, setCachedScore } from '../ai/cache';

// ─── Claude response types ────────────────────────────────────────────────────

interface ContradictionResult {
  contradictions: Array<{
    entityInvolved: string;
    claimA: string;
    claimB: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

// ─── 1. Authorship Trust ─────────────────────────────────────────────────────

function scoreAuthorshipTrust(
  pages: CrawledPage[],
  schemaScore: SchemaScore | null
): { score: number; issues: SemanticTrustIssue[]; signals: string[]; missing: string[] } {
  const issues: SemanticTrustIssue[] = [];
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 40;

  // Look for author signals across pages
  const pagesWithAuthor = pages.filter((page) => {
    const hasAuthorSchema = (page.schemaMarkup as Array<{ '@type'?: string }>)
      .some((s) => s['@type'] === 'Person' || (s as { author?: unknown }).author);
    const hasAuthorText = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b/i.test(page.bodyText);
    return hasAuthorSchema || hasAuthorText;
  });

  const authorCoverage = pagesWithAuthor.length / Math.max(pages.length, 1);

  if (authorCoverage >= 0.5) {
    score += 30;
    signals.push('Author attribution present on majority of pages');
  } else if (authorCoverage >= 0.2) {
    score += 15;
    signals.push('Author attribution present on some pages');
    missing.push('Author attribution missing from most pages');
  } else {
    missing.push('Author identity not established anywhere on site');
    issues.push({
      type: 'missing_author',
      severity: 'critical',
      pageUrl: null,
      description: 'No author identity established across the site.',
      recommendation: 'Add Person schema with author details to articles and key pages. Author identity is a primary AI trust signal.',
    });
  }

  // About page check
  const hasAboutPage = pages.some((p) =>
    p.url.includes('/about') || p.title?.toLowerCase().includes('about')
  );
  if (hasAboutPage) {
    const aboutPage = pages.find((p) =>
      p.url.includes('/about') || p.title?.toLowerCase().includes('about')
    );
    if (aboutPage && aboutPage.wordCount >= 200) {
      score += 15;
      signals.push('About page present with substantial content');
    } else if (aboutPage) {
      score += 5;
      missing.push('About page is thin — insufficient to establish trust');
      issues.push({
        type: 'thin_about_page',
        severity: 'warning',
        pageUrl: aboutPage?.url ?? null,
        description: 'About page exists but has insufficient content to establish authorship or organisational identity.',
        recommendation: 'Expand the About page to include team members, credentials, founding story, and mission. Minimum 300 words.',
      });
    }
  } else {
    missing.push('No About page found');
    issues.push({
      type: 'no_about_page',
      severity: 'warning',
      pageUrl: null,
      description: 'No About page detected.',
      recommendation: 'Create an About page that establishes the identity and credentials of the organisation or individual behind this site.',
    });
  }

  // Schema-based author validation
  if (schemaScore) {
    const hasBiographySchema = schemaScore.detectedTypes.includes('Person');
    if (hasBiographySchema) {
      score += 10;
      signals.push('Person schema detected in structured data');
    }
  }

  return { score: Math.min(100, score), issues, signals, missing };
}

// ─── 2. Organisational Trust ─────────────────────────────────────────────────

function scoreOrganisationalTrust(
  pages: CrawledPage[],
  schemaScore: SchemaScore | null,
  entityReport: EntityIntelligenceReport | null
): { score: number; issues: SemanticTrustIssue[]; signals: string[]; missing: string[] } {
  const issues: SemanticTrustIssue[] = [];
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 30;

  // Organisation schema
  if (schemaScore?.detectedTypes.includes('Organization')) {
    score += 25;
    signals.push('Organization schema present');
  } else {
    missing.push('No Organization schema found');
    issues.push({
      type: 'missing_organisation_schema',
      severity: 'critical',
      pageUrl: null,
      description: 'No Organisation schema markup detected.',
      recommendation: 'Add Organization or LocalBusiness schema with name, url, logo, sameAs, contactPoint, and address. This is the foundation of organisational trust for AI systems.',
    });
  }

  // Contact information
  const hasContactPage = pages.some((p) =>
    p.url.includes('/contact') || p.title?.toLowerCase().includes('contact')
  );
  const hasContactSchema = pages.some((page) =>
    (page.schemaMarkup as Array<{ '@type'?: string; contactPoint?: unknown }>)
      .some((s) => s['@type'] === 'ContactPage' || s.contactPoint)
  );

  if (hasContactPage || hasContactSchema) {
    score += 15;
    signals.push('Contact information present');
  } else {
    missing.push('No contact page or contact schema found');
    issues.push({
      type: 'missing_contact_info',
      severity: 'warning',
      pageUrl: null,
      description: 'No contact information found.',
      recommendation: 'Add a Contact page with a contact form or email address. Add ContactPoint schema to your Organization markup.',
    });
  }

  // Privacy policy
  const hasPrivacyPolicy = pages.some((p) =>
    p.url.includes('/privacy') || p.url.includes('privacy-policy') ||
    p.title?.toLowerCase().includes('privacy')
  );
  if (hasPrivacyPolicy) {
    score += 10;
    signals.push('Privacy policy present');
  } else {
    missing.push('No privacy policy page found');
    issues.push({
      type: 'missing_privacy_policy',
      severity: 'warning',
      pageUrl: null,
      description: 'No privacy policy page detected.',
      recommendation: 'Add a privacy policy page. Its presence signals compliance and organisational legitimacy to AI trust systems.',
    });
  }

  // Terms/legal
  const hasTerms = pages.some((p) =>
    p.url.includes('/terms') || p.url.includes('/legal') ||
    p.title?.toLowerCase().includes('terms')
  );
  if (hasTerms) {
    score += 5;
    signals.push('Terms/legal page present');
  }

  // External validation (sameAs links)
  if (entityReport?.primaryEntity && entityReport.primaryEntity.sameAsUrls.length > 0) {
    score += 15;
    signals.push(`Primary entity has ${entityReport.primaryEntity.sameAsUrls.length} external validation link(s)`);
  } else if (entityReport && entityReport.entitiesDetected.length > 0) {
    missing.push('Primary entity has no external validation links');
  }

  return { score: Math.min(100, score), issues, signals, missing };
}

// ─── 3. Content Trust ────────────────────────────────────────────────────────

function scoreContentTrust(
  pages: CrawledPage[]
): { score: number; issues: SemanticTrustIssue[]; signals: string[]; missing: string[] } {
  const issues: SemanticTrustIssue[] = [];
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 50;

  // Date signals: pages with schema datePublished/dateModified
  const pagesWithDates = pages.filter((page) =>
    (page.schemaMarkup as Array<Record<string, unknown>>)
      .some((s) => s['datePublished'] || s['dateModified'])
  );
  const dateRatio = pagesWithDates.length / Math.max(pages.length, 1);

  if (dateRatio >= 0.5) {
    score += 15;
    signals.push('Date signals present on majority of pages');
  } else if (dateRatio > 0) {
    score += 5;
    missing.push('Date signals missing from most pages');
    issues.push({
      type: 'no_date_signals',
      severity: 'warning',
      pageUrl: null,
      description: 'Most pages lack datePublished or dateModified schema.',
      recommendation: 'Add datePublished and dateModified to Article, BlogPosting, and WebPage schema. Temporal signals are key freshness and reliability indicators.',
    });
  } else {
    score -= 15;
    missing.push('No date signals found anywhere on site');
    issues.push({
      type: 'no_date_signals',
      severity: 'critical',
      pageUrl: null,
      description: 'No publication or modification dates found across any page.',
      recommendation: 'Add datePublished schema to all content pages. Sites without temporal signals are treated as stale by AI retrieval systems.',
    });
  }

  // External citations (links to authoritative sources)
  const authoritativeDomains = ['wikipedia.org', '.gov', '.edu', 'reuters.com', 'bbc.com', 'nature.com', 'pubmed.ncbi', 'wikidata.org'];
  const pagesWithCitations = pages.filter((page) =>
    page.externalLinks.some((link) =>
      authoritativeDomains.some((domain) => link.includes(domain))
    )
  );

  if (pagesWithCitations.length >= 3) {
    score += 15;
    signals.push('Multiple pages cite authoritative external sources');
  } else if (pagesWithCitations.length >= 1) {
    score += 8;
    signals.push('Some external citations to authoritative sources');
  } else {
    missing.push('No external citations to authoritative sources');
    issues.push({
      type: 'missing_citations',
      severity: 'info',
      pageUrl: null,
      description: 'No links to authoritative external sources detected.',
      recommendation: 'Cite authoritative sources (Wikipedia, government sites, academic papers) for factual claims. External citations signal content credibility.',
    });
  }

  // Stale content check
  const now = Date.now();
  const stalePages = pages.filter((page) => {
    for (const schema of page.schemaMarkup as Array<Record<string, unknown>>) {
      const dateStr = typeof schema['dateModified'] === 'string' ? schema['dateModified'] :
                      typeof schema['datePublished'] === 'string' ? schema['datePublished'] : null;
      if (dateStr) {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          const ageYears = (now - date.getTime()) / (1000 * 60 * 60 * 24 * 365);
          return ageYears > 2;
        }
      }
    }
    return false;
  });

  if (stalePages.length > pages.length * 0.3) {
    score -= 10;
    missing.push(`${stalePages.length} pages have content older than 2 years`);
    issues.push({
      type: 'stale_content',
      severity: 'warning',
      pageUrl: null,
      description: `${stalePages.length} pages have not been updated in over 2 years.`,
      recommendation: 'Review and refresh stale content. Update dateModified schema when content is revised. Stale content is down-weighted in AI trust assessments.',
    });
  }

  return { score: Math.min(100, Math.max(0, score)), issues, signals, missing };
}

// ─── 4. Structural Trust ─────────────────────────────────────────────────────

function scoreStructuralTrust(
  pages: CrawledPage[],
  schemaScore: SchemaScore | null
): { score: number; issues: SemanticTrustIssue[]; signals: string[]; missing: string[] } {
  const issues: SemanticTrustIssue[] = [];
  const signals: string[] = [];
  const missing: string[] = [];
  let score = 40;

  // Schema coverage
  if (schemaScore) {
    if (schemaScore.coverage >= 0.7) {
      score += 25;
      signals.push(`Strong schema coverage (${Math.round(schemaScore.coverage * 100)}% of pages)`);
    } else if (schemaScore.coverage >= 0.4) {
      score += 12;
      signals.push(`Moderate schema coverage (${Math.round(schemaScore.coverage * 100)}% of pages)`);
    } else {
      missing.push('Low schema coverage');
      issues.push({
        type: 'schema_trust_mismatch',
        severity: 'warning',
        pageUrl: null,
        description: `Only ${Math.round((schemaScore.coverage ?? 0) * 100)}% of pages have schema markup.`,
        recommendation: 'Expand schema markup coverage to all content pages. Schema is the primary structured trust signal for AI systems.',
      });
    }
  }

  // WebSite/WebPage schema
  const hasWebsiteSchema = pages.some((page) =>
    (page.schemaMarkup as Array<{ '@type'?: string }>)
      .some((s) => s['@type'] === 'WebSite' || s['@type'] === 'WebPage')
  );
  if (hasWebsiteSchema) {
    score += 10;
    signals.push('WebSite/WebPage schema present');
  } else {
    missing.push('No WebSite schema found');
  }

  // Internal link health (broken links are a trust signal problem)
  const pagesWithManyLinks = pages.filter((p) => p.internalLinks.length > 5).length;
  if (pagesWithManyLinks > pages.length * 0.5) {
    score += 10;
    signals.push('Good internal link density');
  }

  // Check for sitelinks-style navigation structure
  const hasNavStructure = pages.some((p) =>
    (p.schemaMarkup as Array<{ '@type'?: string }>)
      .some((s) => s['@type'] === 'BreadcrumbList' || s['@type'] === 'SiteLinksSearchBox')
  );
  if (hasNavStructure) {
    score += 15;
    signals.push('Breadcrumb or SiteLinks schema present');
  }

  return { score: Math.min(100, score), issues, signals, missing };
}

// ─── 5. Contradiction detection (Claude API) ──────────────────────────────────

async function detectContradictions(
  pages: CrawledPage[]
): Promise<SemanticTrustIssue[]> {
  // Top 20 pages only (per CLAUDE.md §18)
  const sample = pages.slice(0, 20);
  if (sample.length < 2) return [];

  const issues: SemanticTrustIssue[] = [];
  const pairCacheKey = buildCacheKey(
    'contradiction-check',
    sample.map((p) => p.url + p.bodyText.slice(0, 200)).join('|')
  );
  const cached = await getCachedScore<SemanticTrustIssue[]>(`contradiction:${pairCacheKey}`);
  if (cached) return cached;

  try {
    // Check first 5 pairs for contradictions (cost control)
    const pairs: Array<[CrawledPage, CrawledPage]> = [];
    for (let i = 0; i < Math.min(sample.length - 1, 4); i++) {
      const pageA = sample[i];
      const pageB = sample[i + 1];
      if (pageA && pageB) pairs.push([pageA, pageB]);
    }

    const results = await Promise.all(
      pairs.map(([pageA, pageB]) =>
        callAI<ContradictionResult>(
          contradictionDetectionPrompt(
            { url: pageA.url, excerpt: pageA.bodyText },
            { url: pageB.url, excerpt: pageB.bodyText }
          )
        ).catch(() => ({ contradictions: [] } as ContradictionResult))
      )
    );

    for (const result of results) {
      for (const contradiction of result.contradictions) {
        issues.push({
          type: 'contradiction_detected',
          severity: contradiction.severity,
          pageUrl: null,
          description: `Contradiction detected on "${contradiction.entityInvolved}": "${contradiction.claimA}" vs "${contradiction.claimB}"`,
          recommendation: 'Resolve conflicting claims about the same entity across pages. Contradictions are a strong negative trust signal for AI systems.',
        });
      }
    }

    await setCachedScore(`contradiction:${pairCacheKey}`, issues);
  } catch {
    // Contradiction detection failure is non-blocking
  }

  return issues;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function analyzeSemanticTrust(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport | null = null,
  schemaScore: SchemaScore | null = null
): Promise<SemanticTrustScore> {
  if (pages.length === 0) {
    return {
      score: 0,
      breakdown: {
        authorshipTrust: 0,
        organisationalTrust: 0,
        contentTrust: 0,
        structuralTrust: 0,
      },
      issues: [],
      trustSignalsPresent: [],
      trustSignalsMissing: [],
    };
  }

  const [
    authorship,
    organisational,
    content,
    structural,
    contradictionIssues,
  ] = await Promise.all([
    Promise.resolve(scoreAuthorshipTrust(pages, schemaScore)),
    Promise.resolve(scoreOrganisationalTrust(pages, schemaScore, entityReport)),
    Promise.resolve(scoreContentTrust(pages)),
    Promise.resolve(scoreStructuralTrust(pages, schemaScore)),
    detectContradictions(pages),
  ]);

  // Contradiction penalty on content trust
  const contradictionPenalty = contradictionIssues.filter((i) => i.severity === 'critical').length * 10
    + contradictionIssues.filter((i) => i.severity === 'warning').length * 5;

  const breakdown = {
    authorshipTrust: authorship.score,
    organisationalTrust: organisational.score,
    contentTrust: Math.max(0, content.score - contradictionPenalty),
    structuralTrust: structural.score,
  };

  const score = Math.round(
    breakdown.authorshipTrust * 0.25
    + breakdown.organisationalTrust * 0.30
    + breakdown.contentTrust * 0.25
    + breakdown.structuralTrust * 0.20
  );

  const allIssues: SemanticTrustIssue[] = [
    ...authorship.issues,
    ...organisational.issues,
    ...content.issues,
    ...structural.issues,
    ...contradictionIssues,
  ];

  const trustSignalsPresent = [
    ...authorship.signals,
    ...organisational.signals,
    ...content.signals,
    ...structural.signals,
  ];

  const trustSignalsMissing = [
    ...authorship.missing,
    ...organisational.missing,
    ...content.missing,
    ...structural.missing,
  ];

  return {
    score,
    breakdown,
    issues: allIssues,
    trustSignalsPresent,
    trustSignalsMissing,
  };
}
