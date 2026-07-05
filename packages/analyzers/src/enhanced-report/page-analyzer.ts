// Page Analyzer — produces PageAnalysisResult for each crawled page.
// Computes per-page SEO, AI visibility, and schema scores with issue linkage.

import type { CrawledPage, AuditIssue, PageAnalysisResult } from '@sitenexis/shared';

function clamp(v: number): number {
  return Math.max(0, Math.min(100, Math.round(v)));
}

function extractPrimaryEntity(page: CrawledPage): string | null {
  for (const s of page.schemaMarkup) {
    if (typeof s !== 'object' || s === null) continue;
    const schema = s as Record<string, unknown>;
    const type = schema['@type'];
    if (['Organization', 'LocalBusiness', 'Person', 'Article', 'Product', 'Service'].includes(String(type))) {
      const name = schema['name'];
      if (typeof name === 'string' && name.length > 0) return name;
    }
  }
  // Fallback: derive from title
  if (page.title) {
    return page.title.replace(/\s*[-|–]\s*.+$/, '').trim() || null;
  }
  return null;
}

function computePageSEOScore(page: CrawledPage): number {
  let score = 100;
  if (!page.title) score -= 20;
  else if (page.title.length > 70) score -= 5;
  else if (page.title.length < 20) score -= 5;
  if (!page.metaDescription) score -= 10;
  else if (page.metaDescription.length > 165) score -= 3;
  if (!page.h1) score -= 15;
  if (!page.canonicalUrl) score -= 8;
  if (page.wordCount < 300) score -= 10;
  if (page.robotsDirectives.some((d) => d.toLowerCase().includes('noindex'))) score -= 10;
  return clamp(score);
}

function computePageAIScore(page: CrawledPage): number {
  const hasSchema = page.hasStructuredData ?? (page.schemaMarkup.length > 0);
  const hasH1 = Boolean(page.h1);
  const wc = page.wordCount;
  const headingCount = page.headings.length;
  const hasFAQ = (page.schemaTypes ?? []).includes('FAQPage');

  let score = 40;
  if (hasH1) score += 10;
  if (hasSchema) score += 20;
  if (hasFAQ) score += 15;
  if (wc > 300) score += 8;
  if (wc > 600) score += 7;
  if (headingCount > 2) score += 5;
  if (page.metaDescription) score += 5;

  // Penalty for extremely thin pages
  if (wc < 100) score -= 20;

  return clamp(score);
}

function computePageSchemaScore(page: CrawledPage): number {
  const types = page.schemaTypes ?? [];
  if (types.length === 0) return 10;
  let score = 30 + types.length * 15;
  if (types.some((t) => ['Organization', 'LocalBusiness'].includes(t))) score += 20;
  if (types.includes('FAQPage')) score += 15;
  if (types.includes('BreadcrumbList')) score += 10;
  return clamp(score);
}

function computeRetrievalQualityScore(page: CrawledPage): number {
  const wc = page.wordCount;
  const hc = page.headings.length;
  const hasSchema = page.hasStructuredData ?? (page.schemaMarkup.length > 0);
  const hasFAQ = (page.schemaTypes ?? []).includes('FAQPage');
  const hasH1 = Boolean(page.h1);

  const expectedChunks = Math.max(1, Math.ceil(wc / 400));
  const chunkStability = Math.min(1, 0.30 + Math.min(0.40, (hc / expectedChunks) * 0.40) + (wc > 300 ? 0.15 : 0) + (hasSchema ? 0.12 : 0));
  const afp = Math.min(1, 0.20 + (hasH1 ? 0.15 : 0) + (page.metaDescription ? 0.10 : 0) + (hasSchema ? 0.20 : 0) + (wc > 400 ? 0.20 : 0) + (hasFAQ ? 0.15 : 0));
  const summarisationLoss = (50 + (hc > 1 ? 15 : 0) + (hasSchema ? 12 : 0) + (wc > 300 ? 10 : 0) + (wc < 3000 ? 8 : 0)) / 100;
  const citationEligibility = (30 + (hasSchema ? 30 : 0) + (hasH1 ? 15 : 0) + (wc > 500 ? 15 : 0) + (hasFAQ ? 10 : 0)) / 100;

  return clamp((chunkStability + afp + summarisationLoss + citationEligibility) * 25);
}

function computeCitationEligibilityScore(page: CrawledPage): number {
  const hasSchema = page.hasStructuredData ?? (page.schemaMarkup.length > 0);
  const hasH1 = Boolean(page.h1);
  const wc = page.wordCount;
  const hasFAQ = (page.schemaTypes ?? []).includes('FAQPage');

  return clamp(25 + (hasSchema ? 30 : 0) + (hasH1 ? 15 : 0) + (wc > 500 ? 15 : 0) + (hasFAQ ? 15 : 0));
}

function generatePageRecommendations(page: CrawledPage): string[] {
  const recs: string[] = [];
  if (!page.title) recs.push('Add a <title> tag of 50–60 characters.');
  if (!page.metaDescription) recs.push('Add a meta description of 120–155 characters.');
  if (!page.h1) recs.push('Add a single H1 heading that names the page topic.');
  if (!page.canonicalUrl) recs.push('Add a canonical URL declaration.');
  if (page.wordCount < 300) recs.push(`Expand content to at least 500 words (currently ${page.wordCount}).`);
  if ((page.schemaMarkup?.length ?? 0) === 0) recs.push('Add JSON-LD schema markup (Organization, Article, or FAQPage).');
  if (page.images.some((img) => !img.alt || img.alt.trim() === '')) {
    recs.push('Add descriptive alt text to all images.');
  }
  return recs.slice(0, 4);
}

export function analyzePages(pages: CrawledPage[], issues: AuditIssue[]): PageAnalysisResult[] {
  return pages.slice(0, 50).map((page) => {
    const pageIssueIds = issues
      .filter((i) => i.affectedPages.includes(page.url))
      .map((i) => i.id);

    return {
      url: page.url,
      title: page.title,
      issueIds: pageIssueIds,
      scores: {
        seo: computePageSEOScore(page),
        aiVisibility: computePageAIScore(page),
        schema: computePageSchemaScore(page),
      },
      retrievalQualityScore: computeRetrievalQualityScore(page),
      citationEligibilityScore: computeCitationEligibilityScore(page),
      primaryEntity: extractPrimaryEntity(page),
      schemaTypes: page.schemaTypes ?? [],
      wordCount: page.wordCount,
      recommendations: generatePageRecommendations(page),
    };
  });
}
