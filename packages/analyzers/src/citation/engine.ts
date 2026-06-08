import { readFileSync } from 'fs';
import { join } from 'path';
import type {
  CrawledPage,
  CitationAnalysis,
  CitationPageAnalysis,
  CitationFactorBreakdown,
  EntityIntelligenceReport,
  SchemaScore,
  ContentFormatType,
} from '@sitenexis/shared';

// ─── Config loading ───────────────────────────────────────────────────────────

interface CitationWeightsConfig {
  factors: {
    factualDensity: number;
    claimSpecificity: number;
    primaryEntityAuthority: number;
    topicalAuthorityDepth: number;
    structuralCitationReadiness: number;
    temporalFreshness: number;
    trustSignalDensity: number;
  };
}

function loadWeights(): CitationWeightsConfig['factors'] {
  try {
    const configPath = join(process.cwd(), '../../config/citation-weights.json');
    const raw = readFileSync(configPath, 'utf-8');
    const config = JSON.parse(raw) as CitationWeightsConfig;
    return config.factors;
  } catch {
    // Fallback to CLAUDE.md §16 defaults
    return {
      factualDensity: 0.20,
      claimSpecificity: 0.15,
      primaryEntityAuthority: 0.15,
      topicalAuthorityDepth: 0.15,
      structuralCitationReadiness: 0.15,
      temporalFreshness: 0.10,
      trustSignalDensity: 0.10,
    };
  }
}

// ─── Factor scorers (0–100 each) ─────────────────────────────────────────────

// Factual density: presence of numbers, dates, statistics, proper nouns
function scoreFactualDensity(page: CrawledPage): number {
  const text = page.bodyText;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 50) return 10;

  const numberPattern = /\b\d+(?:[.,]\d+)?(?:\s*%|\s*(?:million|billion|thousand|k|m|bn))?\b/gi;
  const datePattern = /\b(?:\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}|\b(?:january|february|march|april|may|june|july|august|september|october|november|december)\b)/gi;
  const capitalPattern = /\b[A-Z][a-z]{2,}(?:\s[A-Z][a-z]+)*\b/g;

  const numbers = (text.match(numberPattern) ?? []).length;
  const dates = (text.match(datePattern) ?? []).length;
  const properNouns = (text.match(capitalPattern) ?? []).length;

  const factualTokensPerHundredWords = ((numbers + dates + properNouns) / words.length) * 100;

  if (factualTokensPerHundredWords >= 15) return 90;
  if (factualTokensPerHundredWords >= 10) return 75;
  if (factualTokensPerHundredWords >= 6) return 55;
  if (factualTokensPerHundredWords >= 3) return 35;
  return 15;
}

// Claim specificity: named, verifiable specific claims rather than vague statements
function scoreClaimSpecificity(page: CrawledPage): number {
  const text = page.bodyText;

  const specificPatterns = [
    /\b(?:founded|established|launched|released|created)\s+in\s+\d{4}\b/gi,
    /\b\d+(?:\.\d+)?\s*(?:million|billion|thousand|%|percent|employees|users|customers)\b/gi,
    /\b(?:headquartered|located|based)\s+in\s+[A-Z][a-z]+/gi,
    /\b(?:costs?|priced?\s+at|starts?\s+at|from)\s+\$[\d,]+/gi,
    /\b(?:version|v)\s*\d+\.\d+/gi,
  ];

  const vaguePatterns = [
    /\b(?:many|some|several|various|numerous|lots of|a lot of)\s+(?:people|companies|users|customers)\b/gi,
    /\b(?:great|amazing|excellent|best|leading|top|premier)\s+(?:solution|platform|service|company|product)\b/gi,
    /\bworld[\s-]class\b|\bindustry[\s-]leading\b|\bcutting[\s-]edge\b|\bstate[\s-]of[\s-]the[\s-]art\b/gi,
  ];

  let specificCount = 0;
  let vagueCount = 0;

  for (const pattern of specificPatterns) {
    specificCount += (text.match(pattern) ?? []).length;
  }
  for (const pattern of vaguePatterns) {
    vagueCount += (text.match(pattern) ?? []).length;
  }

  const ratio = specificCount > 0
    ? specificCount / (specificCount + vagueCount)
    : 0;

  if (specificCount >= 8 && ratio > 0.6) return 85;
  if (specificCount >= 5 && ratio > 0.4) return 70;
  if (specificCount >= 3) return 50;
  if (specificCount >= 1) return 30;
  return 10;
}

// Primary entity authority: does the page establish authoritative knowledge about its primary entity?
function scorePrimaryEntityAuthority(
  _page: CrawledPage,
  entityReport: EntityIntelligenceReport | null
): number {
  if (!entityReport || entityReport.entitiesDetected.length === 0) return 20;

  const primaryEntity = entityReport.primaryEntity;
  if (!primaryEntity) return 25;

  let score = 40;

  // Entity has external sameAs links → high authority signal
  if (primaryEntity.sameAsUrls.length >= 2) score += 30;
  else if (primaryEntity.sameAsUrls.length === 1) score += 15;

  // Entity mentioned frequently
  if (primaryEntity.mentionCount >= 10) score += 15;
  else if (primaryEntity.mentionCount >= 5) score += 8;

  // Entity has a description
  if (primaryEntity.description) score += 10;

  // High entity confidence score
  if (entityReport.entityConfidenceScore >= 75) score += 5;

  return Math.min(100, score);
}

// Topical authority depth: breadth of coverage within the topic domain
function scoreTopicalAuthorityDepth(page: CrawledPage, allPages: CrawledPage[]): number {
  // Measure how well this page's topic is covered across the site
  const internalLinks = page.internalLinks.length;
  const wordCount = page.wordCount;
  const headingCount = page.headings.length;

  let score = 30;

  // Rich content signals depth
  if (wordCount >= 1500) score += 20;
  else if (wordCount >= 800) score += 12;
  else if (wordCount >= 400) score += 5;

  // Well-structured content
  if (headingCount >= 4) score += 15;
  else if (headingCount >= 2) score += 8;

  // Internal link density (well-connected pages have topical authority)
  const internalLinkDensity = internalLinks / Math.max(allPages.length, 1);
  if (internalLinkDensity >= 0.3) score += 15;
  else if (internalLinkDensity >= 0.1) score += 8;
  else if (internalLinks >= 3) score += 4;

  // Schema markup presence boosts topical signals
  if (page.schemaMarkup.length > 0) score += 10;

  return Math.min(100, score);
}

// Structural citation readiness: direct answers, FAQ markup, numbered lists
function scoreStructuralCitationReadiness(page: CrawledPage): number {
  const text = page.bodyText;
  let score = 30;

  // FAQ-style question patterns
  const questionPattern = /\b(?:what|how|why|when|where|who|which)\s+(?:is|are|was|were|does|do|should|can|will)\b/gi;
  const questions = (text.match(questionPattern) ?? []).length;
  if (questions >= 3) score += 20;
  else if (questions >= 1) score += 10;

  // Direct answer patterns
  const directAnswerPattern = /^(?:yes|no|the answer is|in short|briefly|to summarize|in summary|the key (?:point|takeaway))/gim;
  const directAnswers = (text.match(directAnswerPattern) ?? []).length;
  if (directAnswers >= 2) score += 15;
  else if (directAnswers >= 1) score += 8;

  // Schema FAQ markup
  const schemaTypes = (page.schemaMarkup as Array<{ '@type'?: string }>)
    .map((s) => s['@type'])
    .filter(Boolean);
  if (schemaTypes.includes('FAQPage')) score += 20;
  if (schemaTypes.includes('HowTo')) score += 10;
  if (schemaTypes.includes('Article') || schemaTypes.includes('BlogPosting')) score += 5;

  // Numbered or bulleted lists indicate structured, citable content
  const listPattern = /^\d+\.\s+\w|^[\-\*•]\s+\w/gm;
  const listItems = (text.match(listPattern) ?? []).length;
  if (listItems >= 5) score += 10;
  else if (listItems >= 2) score += 5;

  return Math.min(100, score);
}

// Temporal freshness: recency signals reduce citation suppression in time-sensitive retrieval
function scoreTemporalFreshness(page: CrawledPage): number {
  const text = page.bodyText;
  const schemaMarkup = page.schemaMarkup as Array<Record<string, unknown>>;

  // Look for dateModified or datePublished in schema
  for (const schema of schemaMarkup) {
    const dateModified = schema['dateModified'];
    const datePublished = schema['datePublished'];
    const dateStr = (typeof dateModified === 'string' ? dateModified : null)
      ?? (typeof datePublished === 'string' ? datePublished : null);

    if (dateStr) {
      const date = new Date(dateStr);
      if (!isNaN(date.getTime())) {
        const ageMonths = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24 * 30);
        if (ageMonths < 3) return 95;
        if (ageMonths < 6) return 80;
        if (ageMonths < 12) return 60;
        if (ageMonths < 24) return 40;
        return 20;
      }
    }
  }

  // Infer from current year mentions
  const currentYear = new Date().getFullYear();
  if (text.includes(String(currentYear))) return 70;
  if (text.includes(String(currentYear - 1))) return 50;

  return 35; // No temporal signals = moderate freshness penalty
}

// Trust signal density: authorship, organisation, contact, review schema
function scoreTrustSignalDensity(page: CrawledPage): number {
  let score = 20;

  const schemaTypes = (page.schemaMarkup as Array<{ '@type'?: string }>)
    .map((s) => s['@type'])
    .filter(Boolean);

  const highTrustTypes = ['Organization', 'LocalBusiness', 'Person', 'Author'];
  const medTrustTypes = ['WebSite', 'WebPage', 'Article', 'BlogPosting'];
  const citationTrustTypes = ['Review', 'AggregateRating', 'Certification'];

  for (const type of schemaTypes) {
    if (highTrustTypes.includes(type ?? '')) score += 20;
    else if (medTrustTypes.includes(type ?? '')) score += 10;
    else if (citationTrustTypes.includes(type ?? '')) score += 15;
  }

  // External links to authoritative sources (citations)
  const authoritativeDomains = ['wikipedia.org', 'gov', 'edu', 'nytimes.com', 'bbc.com', 'reuters.com', 'wikidata.org'];
  const hasAuthoritativeLinks = page.externalLinks.some((link) =>
    authoritativeDomains.some((domain) => link.includes(domain))
  );
  if (hasAuthoritativeLinks) score += 10;

  // Author in body text
  const authorPattern = /\bby\s+[A-Z][a-z]+\s+[A-Z][a-z]+\b|\bauthor:\s*/i;
  if (authorPattern.test(page.bodyText)) score += 10;

  return Math.min(100, score);
}

// ─── Page-level citation analysis ────────────────────────────────────────────

function analyzePage(
  page: CrawledPage,
  allPages: CrawledPage[],
  entityReport: EntityIntelligenceReport | null,
  weights: CitationWeightsConfig['factors']
): CitationPageAnalysis {
  const factors: CitationFactorBreakdown = {
    factualDensity: scoreFactualDensity(page),
    claimSpecificity: scoreClaimSpecificity(page),
    primaryEntityAuthority: scorePrimaryEntityAuthority(page, entityReport),
    topicalAuthorityDepth: scoreTopicalAuthorityDepth(page, allPages),
    structuralCitationReadiness: scoreStructuralCitationReadiness(page),
    temporalFreshness: scoreTemporalFreshness(page),
    trustSignalDensity: scoreTrustSignalDensity(page),
  };

  const citationProbability = Math.round(
    factors.factualDensity * weights.factualDensity
    + factors.claimSpecificity * weights.claimSpecificity
    + factors.primaryEntityAuthority * weights.primaryEntityAuthority
    + factors.topicalAuthorityDepth * weights.topicalAuthorityDepth
    + factors.structuralCitationReadiness * weights.structuralCitationReadiness
    + factors.temporalFreshness * weights.temporalFreshness
    + factors.trustSignalDensity * weights.trustSignalDensity
  );

  const blockers: string[] = [];
  if (factors.factualDensity < 30) blockers.push('Low factual density — insufficient verifiable claims for AI citation');
  if (factors.claimSpecificity < 30) blockers.push('Vague, generic claims — AI systems prefer specific, verifiable statements');
  if (factors.temporalFreshness < 30) blockers.push('No freshness signals — stale content is down-weighted in recency-sensitive retrieval');
  if (factors.trustSignalDensity < 30) blockers.push('Missing trust signals — no author, organisation, or authority schema');
  if (factors.structuralCitationReadiness < 30) blockers.push('No direct-answer structure — content not formatted for AI answer extraction');

  return { url: page.url, citationProbability, factors, blockers };
}

// ─── Intelligence Module: Content format classifier ───────────────────────────

/**
 * Classifies the dominant content format of a page based on title + structure.
 * AI systems cite different formats at different rates — "Best X" and
 * comparison formats achieve 3–5× the citation rate of general narrative posts.
 */
function classifyContentFormat(pages: CrawledPage[]): ContentFormatType {
  if (pages.length === 0) return 'general';

  const titleCounts: Record<ContentFormatType, number> = {
    best_x: 0, comparison: 0, definition: 0, guide: 0,
    procedural: 0, evaluative: 0, factual: 0, general: 0,
  };

  for (const page of pages) {
    const title = (page.title ?? '').toLowerCase();
    const body  = (page.bodyText ?? '').toLowerCase();

    if (/\b(best|top \d+|top-\d+)\b/.test(title))                      titleCounts.best_x++;
    else if (/\bvs\.?\b|\bversus\b|\bcompared?\b|\balternative/.test(title)) titleCounts.comparison++;
    else if (/\bwhat is\b|\bwhat are\b|\bdefinition\b|\bexplained\b/.test(title)) titleCounts.definition++;
    else if (/\bhow to\b|\bstep.by.step\b|\btutorial\b/.test(title))    titleCounts.procedural++;
    else if (/\bguide\b|\bguide to\b|\bcomplete guide\b/.test(title))   titleCounts.guide++;
    else if (/\breview\b|\brated\b|\bis .* good\b|\bworth\b/.test(title)) titleCounts.evaluative++;
    else if (/\d+%|\d+ (million|billion|thousand)|\bstatistic\b|\bdata\b/.test(body) &&
             (page.bodyText ?? '').split(/\s+/).length > 600)            titleCounts.factual++;
    else                                                                 titleCounts.general++;
  }

  // Return the most dominant format (excluding 'general' if another wins)
  const sorted = (Object.entries(titleCounts) as [ContentFormatType, number][])
    .sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  // Only declare a format winner if it represents > 20% of pages
  if (top && top[1] > pages.length * 0.2 && top[0] !== 'general') return top[0];
  // Check if 'general' is explicitly dominant
  return 'general';
}

/**
 * Computes the gap between citation eligibility and retrieval readiness.
 * Uses structural citation readiness and factual density as a retrieval proxy.
 *
 * Positive gap: content is more citable than retrievable (chunk structure issue)
 * Negative gap: content is more retrievable than citable (factual density issue)
 */
function computeRetrievalCitationGap(
  pageAnalyses: CitationPageAnalysis[],
  citationProbabilityScore: number,
): number {
  if (pageAnalyses.length === 0) return 0;

  // Proxy for retrieval readiness: avg of structural readiness + factual density
  const avgRetrievability = Math.round(
    pageAnalyses.reduce(
      (sum, p) =>
        sum +
        (p.factors.structuralCitationReadiness * 0.5 + p.factors.factualDensity * 0.5),
      0,
    ) / pageAnalyses.length,
  );

  return citationProbabilityScore - avgRetrievability;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeCitationProbability(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport | null = null,
  _schemaScore: SchemaScore | null = null
): CitationAnalysis {
  if (pages.length === 0) {
    return {
      citationProbabilityScore: 0,
      pageAnalyses: [],
      topCitationCandidates: [],
      citationBlockers: [],
      recommendations: [],
    };
  }

  const weights = loadWeights();
  const pageAnalyses = pages.map((page) => analyzePage(page, pages, entityReport, weights));

  const citationProbabilityScore = Math.round(
    pageAnalyses.reduce((sum, p) => sum + p.citationProbability, 0) / pageAnalyses.length
  );

  const sorted = [...pageAnalyses].sort((a, b) => b.citationProbability - a.citationProbability);
  const topCitationCandidates = sorted.slice(0, 5).map((p) => p.url);

  // Aggregate blockers across all pages
  const blockerCounts = new Map<string, number>();
  for (const analysis of pageAnalyses) {
    for (const blocker of analysis.blockers) {
      blockerCounts.set(blocker, (blockerCounts.get(blocker) ?? 0) + 1);
    }
  }
  const citationBlockers = [...blockerCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([blocker]) => blocker);

  const recommendations: string[] = [];
  if (citationProbabilityScore < 40) {
    recommendations.push('Increase factual density by adding specific, verifiable claims with dates, statistics, and named entities.');
  }
  if (pageAnalyses.some((p) => p.factors.structuralCitationReadiness < 50)) {
    recommendations.push('Add FAQ schema markup and direct-answer content structure to improve AI citation extraction.');
  }
  if (pageAnalyses.some((p) => p.factors.temporalFreshness < 50)) {
    recommendations.push('Add datePublished/dateModified schema markup to signal content freshness to AI retrieval systems.');
  }
  if (pageAnalyses.some((p) => p.factors.trustSignalDensity < 50)) {
    recommendations.push('Add author schema, organisation schema, and external citations to authoritative sources to build trust density.');
  }
  if (pageAnalyses.every((p) => p.factors.primaryEntityAuthority < 60)) {
    recommendations.push('Establish primary entity authority with comprehensive schema markup and sameAs links to knowledge graph sources.');
  }

  return {
    citationProbabilityScore,
    pageAnalyses,
    topCitationCandidates,
    citationBlockers,
    recommendations,
    contentFormatClassification: classifyContentFormat(pages),
    retrievalCitationGap: computeRetrievalCitationGap(pageAnalyses, citationProbabilityScore),
  };
}
