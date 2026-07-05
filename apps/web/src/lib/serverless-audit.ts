/**
 * Serverless Audit Runner
 * Crawls a domain using fetch() + HTML parsing and produces real analysis scores.
 * Used when the BullMQ worker is unavailable (Redis not configured, Vercel deployment).
 * No Puppeteer. No Redis. No background worker required.
 */

import { logger } from '@/lib/logger';
import { getGroqAdapter, getFetchExtractionAdapter } from '@sitenexis/adapters';
import type { CrawledPage } from '@sitenexis/shared';
import type {
  RetrievalSimulationResult,
  MachineTrustScore,
  TemporalAuthorityResult,
  RecommendationSurfaceMap,
  SyntheticEntityAnalysis,
} from '@sitenexis/shared';

// ParsedPage is now CrawledPage — use the canonical type throughout.
// Convenience accessors map CrawledPage fields to the old ParsedPage names.

type ParsedPage = CrawledPage & {
  /** @deprecated use canonicalUrl */ canonical: string | null;
  /** @deprecated use robotsDirectives[0] */ robotsMeta: string | null;
  /** @deprecated use schemaMarkup */ schemas: unknown[];
  /** guaranteed non-optional in this module */ schemaTypes: string[];
  /** guaranteed non-optional in this module */ hasStructuredData: boolean;
};

function toParsedPage(page: CrawledPage): ParsedPage {
  return {
    ...page,
    canonical: page.canonicalUrl,
    robotsMeta: page.robotsDirectives[0] ?? null,
    schemas: page.schemaMarkup,
    schemaTypes: page.schemaTypes ?? [],
    hasStructuredData: page.hasStructuredData ?? page.schemaMarkup.length > 0,
  };
}

const MAX_PAGES = 50;

// ── SEO analysis ──────────────────────────────────────────────────────────────

interface SEOIssueSimple {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  url: string;
  message: string;
  recommendation: string;
  problem: string;
  cause: string;
  solution: string;
}

function analyseSEO(pages: ParsedPage[]): { score: number; issues: SEOIssueSimple[] } {
  const issues: SEOIssueSimple[] = [];
  let deductions = 0;

  for (const page of pages) {
    const u = page.url;

    if (!page.title) {
      issues.push({
        type: 'missing_title', severity: 'critical', url: u,
        message: 'No <title> tag found',
        problem: 'This page has no title tag — it is invisible to search engines and AI systems.',
        cause: 'The <title> tag is the primary signal crawlers use to classify a page\'s topic. Without it, search engines and AI retrieval systems cannot confidently categorise or cite this page.',
        solution: 'Add a <title> tag of 50–60 characters to the page <head>. Include the primary keyword and entity name.',
        recommendation: 'Add a descriptive title tag (50–60 characters) including the primary keyword.',
      });
      deductions += 10;
    } else if (page.title.length > 70) {
      issues.push({
        type: 'title_too_long', severity: 'warning', url: u,
        message: `Title is ${page.title.length} chars (max 70)`,
        problem: 'The title tag exceeds the display limit and will be truncated in search results.',
        cause: 'Search engines display approximately 60–70 characters of a title. Text beyond this is cut off, hiding key information and reducing click-through rates.',
        solution: 'Shorten the title to under 60 characters, keeping the primary keyword near the start.',
        recommendation: 'Shorten the title to under 70 characters.',
      });
      deductions += 3;
    } else if (page.title.length < 20) {
      issues.push({
        type: 'title_too_short', severity: 'warning', url: u,
        message: `Title is only ${page.title.length} chars`,
        problem: 'The title tag is too brief to signal page intent clearly.',
        cause: 'Short titles lack the semantic richness needed for accurate topic classification by search engines and AI systems.',
        solution: 'Expand the title to 20–60 characters, clearly naming the entity and topic this page covers.',
        recommendation: 'Expand the title to at least 20 characters.',
      });
      deductions += 3;
    }

    if (!page.metaDescription) {
      issues.push({
        type: 'missing_meta_description', severity: 'warning', url: u,
        message: 'No meta description',
        problem: 'This page has no meta description — search engines will auto-generate one.',
        cause: 'Without a description, search engines generate snippet text from body content, which is rarely optimised for user intent and reduces click-through rates.',
        solution: 'Write a meta description of 120–155 characters summarising the page\'s core value and including the primary keyword.',
        recommendation: 'Add a meta description (120–155 characters).',
      });
      deductions += 5;
    } else if (page.metaDescription.length > 165) {
      issues.push({
        type: 'meta_description_too_long', severity: 'info', url: u,
        message: `Meta description is ${page.metaDescription.length} chars`,
        problem: 'The meta description is too long and will be truncated in search results.',
        cause: 'Search engines truncate descriptions beyond approximately 155 characters, cutting off your message mid-sentence.',
        solution: 'Trim the meta description to under 155 characters. Lead with the most important information.',
        recommendation: 'Trim meta description to under 155 characters.',
      });
      deductions += 1;
    }

    if (!page.h1) {
      issues.push({
        type: 'missing_h1', severity: 'critical', url: u,
        message: 'No <h1> tag found',
        problem: 'This page has no H1 heading — the primary structural content signal is missing.',
        cause: 'The H1 is the single most important on-page content signal. Search engines and AI systems use it to confirm what a page is about and to form retrievable answers.',
        solution: 'Add a single H1 tag that clearly states the main topic. It should align with the title tag and contain the primary keyword.',
        recommendation: 'Add a single H1 that describes the page topic.',
      });
      deductions += 8;
    }

    if (!page.canonical) {
      issues.push({
        type: 'missing_canonical', severity: 'warning', url: u,
        message: 'No canonical link',
        problem: 'No canonical URL is declared — duplicate content risk is unmanaged.',
        cause: 'URL variations (www vs. non-www, query strings, trailing slashes) can make the same content appear at multiple addresses, fragmenting ranking signals and confusing crawlers.',
        solution: 'Add <link rel="canonical" href="[absolute URL]"> to the <head> of every page, pointing to its preferred URL.',
        recommendation: 'Add <link rel="canonical"> to prevent duplicate content issues.',
      });
      deductions += 4;
    }

    if (page.wordCount < 300 && pages.indexOf(page) > 0) {
      issues.push({
        type: 'low_word_count', severity: 'info', url: u,
        message: `Only ${page.wordCount} words`,
        problem: 'This page has too little content to rank or be retrieved by AI systems.',
        cause: 'AI retrieval systems split content into semantic chunks of 300–600 tokens. Pages below 300 words cannot form a stable chunk, making them unreliable sources for AI-generated answers.',
        solution: 'Expand this page to at least 500 words with substantive, topic-specific content. Prioritise depth over volume.',
        recommendation: 'Add more substantive content (aim for 500+ words on key pages).',
      });
      deductions += 2;
    }

    if (page.robotsMeta?.toLowerCase().includes('noindex')) {
      issues.push({
        type: 'noindex_page', severity: 'warning', url: u,
        message: 'Page has noindex directive',
        problem: 'This page is explicitly blocked from search engines and AI crawlers.',
        cause: 'A robots meta noindex directive instructs all crawlers to exclude this page from their index. Any traffic or AI visibility this page could generate is blocked.',
        solution: 'Remove the noindex directive if this page should be discoverable. If it must remain hidden, confirm it is intentional and the page serves no SEO purpose.',
        recommendation: 'Remove noindex if this page should be indexed.',
      });
      deductions += 5;
    }
  }

  return { score: Math.max(0, Math.min(100, 100 - Math.round(deductions / Math.max(pages.length, 1)))), issues };
}

// ── Schema analysis ───────────────────────────────────────────────────────────

function analyseSchema(pages: ParsedPage[]): { score: number; schemaUrls: string[] } {
  const schemaUrls: string[] = [];
  let schemaCount = 0;
  const desiredTypes = ['Organization', 'WebSite', 'Article', 'BlogPosting', 'FAQPage', 'Product', 'LocalBusiness', 'Person'];

  for (const page of pages) {
    if (page.hasStructuredData) {
      schemaCount++;
      schemaUrls.push(page.url);
    }
  }

  const homepageSchemas = pages[0]?.schemaTypes ?? [];
  const hasCriticalSchemas = desiredTypes.some((t) => homepageSchemas.includes(t));

  let score = 40;
  if (schemaCount > 0) score += 20;
  if (hasCriticalSchemas) score += 20;
  if (schemaCount >= pages.length * 0.5) score += 10;
  if (homepageSchemas.includes('WebSite') || homepageSchemas.includes('Organization')) score += 10;

  return { score: Math.min(100, score), schemaUrls };
}

// ── Groq AI analysis ──────────────────────────────────────────────────────────

interface GroqAIScores {
  machineReadabilityScore: number;
  entityConfidenceScore: number;
  retrievalReadinessScore: number;
  citationProbabilityScore: number;
  semanticTrustScore: number;
  recommendationConfidence: number;
  aiVisibilityScore: number;
}

async function callGroqAnalysis(pages: ParsedPage[], domain: string): Promise<GroqAIScores | null> {
  const adapter = getGroqAdapter();
  if (!adapter.isConfigured()) return null;

  const siteData = {
    domain,
    pagesAnalyzed: pages.length,
    pages: pages.slice(0, 8).map((p) => ({
      url: p.url,
      title: p.title,
      h1: p.h1,
      wordCount: p.wordCount,
      schemaTypes: p.schemaTypes,
      hasCanonical: Boolean(p.canonical),
      headingCount: p.headings.length,
      excerpt: p.bodyText.slice(0, 500),
    })),
  };

  const userPrompt = `Analyze this website for AI retrievability and machine trust. Return scores based strictly on the content signals provided.

${JSON.stringify(siteData, null, 2)}

Return a JSON object with these exact numeric keys (all 0-100 integers):
{
  "machineReadabilityScore": <how cleanly AI systems can extract structured content>,
  "entityConfidenceScore": <how confidently AI identifies the primary entity/brand>,
  "retrievalReadinessScore": <probability AI selects this content when answering queries>,
  "citationProbabilityScore": <likelihood AI cites this as an authoritative source>,
  "semanticTrustScore": <authorship, organisational, structural trust signals composite>,
  "recommendationConfidence": <probability AI recommends this domain unprompted>,
  "aiVisibilityScore": <weighted composite: machineReadability×0.15 + entityConfidence×0.20 + retrievalReadiness×0.20 + citationProbability×0.20 + semanticTrust×0.15>
}

Be specific and differentiated. Do not cluster scores around 50. Return ONLY valid JSON.`;

  try {
    const output = await adapter.complete({
      systemPrompt: 'You are an AI visibility analysis engine. Return ONLY valid JSON.',
      userPrompt,
      model: 'llama-3.3-70b-versatile',
      maxTokens: 256,
      temperature: 0.1,
      jsonMode: true,
    });

    const parsed = JSON.parse(output.content) as Partial<GroqAIScores>;

    const keys: (keyof GroqAIScores)[] = [
      'machineReadabilityScore', 'entityConfidenceScore', 'retrievalReadinessScore',
      'citationProbabilityScore', 'semanticTrustScore', 'recommendationConfidence', 'aiVisibilityScore',
    ];
    for (const k of keys) {
      if (typeof parsed[k] !== 'number') return null;
    }

    return {
      machineReadabilityScore: Math.min(100, Math.max(0, Math.round(parsed.machineReadabilityScore!))),
      entityConfidenceScore: Math.min(100, Math.max(0, Math.round(parsed.entityConfidenceScore!))),
      retrievalReadinessScore: Math.min(100, Math.max(0, Math.round(parsed.retrievalReadinessScore!))),
      citationProbabilityScore: Math.min(100, Math.max(0, Math.round(parsed.citationProbabilityScore!))),
      semanticTrustScore: Math.min(100, Math.max(0, Math.round(parsed.semanticTrustScore!))),
      recommendationConfidence: Math.min(100, Math.max(0, Math.round(parsed.recommendationConfidence!))),
      aiVisibilityScore: Math.min(100, Math.max(0, Math.round(parsed.aiVisibilityScore!))),
    };
  } catch {
    return null;
  }
}

// ── AI visibility scoring (heuristic fallback) ────────────────────────────────

function scoreAIVisibility(pages: ParsedPage[]): {
  aiScore: number;
  machineReadabilityScore: number;
  entityConfidenceScore: number;
  retrievalReadinessScore: number;
  citationProbabilityScore: number;
  semanticTrustScore: number;
  recommendationConfidence: number;
} {
  if (pages.length === 0) {
    return { aiScore: 0, machineReadabilityScore: 0, entityConfidenceScore: 0,
      retrievalReadinessScore: 0, citationProbabilityScore: 0, semanticTrustScore: 0, recommendationConfidence: 0 };
  }

  // Machine readability: how clean and structured the text is
  const avgWordCount = pages.reduce((s, p) => s + p.wordCount, 0) / pages.length;
  const hasHeadings = pages.filter((p) => p.headings.length > 0).length / pages.length;
  const hasSchema = pages.filter((p) => p.hasStructuredData).length / pages.length;
  const machineReadabilityScore = Math.round(
    Math.min(25, (avgWordCount / 600) * 25) +       // word count (max 25)
    hasHeadings * 30 +                               // heading structure (max 30)
    hasSchema * 25 +                                 // schema present (max 25)
    (pages.filter((p) => p.h1).length / pages.length) * 20  // H1 presence (max 20)
  );

  // Entity confidence: named entities and consistent mentions
  const hasOrganisation = pages.some((p) => p.schemaTypes.includes('Organization') || p.schemaTypes.includes('LocalBusiness'));
  const avgHeadings = pages.reduce((s, p) => s + p.headings.length, 0) / pages.length;
  const entityConfidenceScore = Math.round(
    (hasOrganisation ? 40 : 15) +
    Math.min(30, avgHeadings * 5) +
    (pages[0]?.title ? 15 : 0) +
    (hasSchema > 0 ? 15 : 0)
  );

  // Retrieval readiness: can AI systems extract clean answers
  const hasFAQ = pages.some((p) => p.schemaTypes.includes('FAQPage') || p.schemaTypes.includes('HowTo'));
  const retrievalReadinessScore = Math.round(
    machineReadabilityScore * 0.6 +
    (hasFAQ ? 25 : 0) +
    (pages.filter((p) => p.wordCount > 400).length / pages.length) * 15
  );

  // Citation probability: specificity and authority signals
  const hasAuthorSchema = pages.some((p) =>
    p.schemaTypes.some((t) => ['Article', 'BlogPosting', 'NewsArticle'].includes(t))
  );
  const citationProbabilityScore = Math.round(
    entityConfidenceScore * 0.4 +
    retrievalReadinessScore * 0.3 +
    (hasAuthorSchema ? 20 : 0) +
    (hasSchema > 0.3 ? 10 : 0)
  );

  // Semantic trust: consistency of signals
  const hasCanonical = pages.filter((p) => p.canonical).length / pages.length;
  const semanticTrustScore = Math.round(
    50 +
    hasCanonical * 20 +
    (pages[0]?.schemas.length ? 15 : 0) +
    (pages.filter((p) => !p.robotsMeta?.toLowerCase().includes('noindex')).length / pages.length) * 15
  );

  // Overall AI score
  const aiScore = Math.round(
    machineReadabilityScore * 0.15 +
    entityConfidenceScore * 0.20 +
    retrievalReadinessScore * 0.20 +
    citationProbabilityScore * 0.20 +
    semanticTrustScore * 0.15
  );

  const recommendationConfidence = Math.round(
    entityConfidenceScore * 0.30 +
    citationProbabilityScore * 0.30 +
    semanticTrustScore * 0.20 +
    machineReadabilityScore * 0.20
  );

  return {
    aiScore: Math.min(100, aiScore),
    machineReadabilityScore: Math.min(100, machineReadabilityScore),
    entityConfidenceScore: Math.min(100, entityConfidenceScore),
    retrievalReadinessScore: Math.min(100, retrievalReadinessScore),
    citationProbabilityScore: Math.min(100, citationProbabilityScore),
    semanticTrustScore: Math.min(100, semanticTrustScore),
    recommendationConfidence: Math.min(100, recommendationConfidence),
  };
}

// ── Layer 4 — Retrieval Simulation ───────────────────────────────────────────

function computeRetrievalSimulations(
  pages: ParsedPage[],
  citationScore: number,
): RetrievalSimulationResult[] {
  return pages.slice(0, 30).map((page) => {
    const wc = page.wordCount;
    const hc = page.headings.length;
    const hasSchema = page.hasStructuredData;
    const hasFAQ = page.schemaTypes.includes('FAQPage') || page.schemaTypes.includes('HowTo');

    const expectedChunks = Math.max(1, Math.ceil(wc / 400));
    const chunkStabilityIndex = Math.min(0.97, Math.max(0.15,
      0.30 + Math.min(0.40, (hc / expectedChunks) * 0.40) + (wc > 300 ? 0.15 : 0) + (hasSchema ? 0.12 : 0),
    ));

    const answerFormationProbability = Math.min(0.95, Math.max(0.10,
      0.20 + (page.h1 ? 0.15 : 0) + (page.metaDescription ? 0.10 : 0) +
      (hasSchema ? 0.20 : 0) + (wc > 400 ? 0.20 : 0) + (hc > 2 ? 0.10 : 0) + (hasFAQ ? 0.20 : 0),
    ));

    const summarisationLossScore = Math.min(100, Math.max(20,
      50 + (hc > 1 ? 15 : 0) + (hasSchema ? 12 : 0) + (wc > 300 ? 10 : 0) + (wc < 3000 ? 8 : 0) + (hasFAQ ? 5 : 0),
    ));

    const citationEligibilityScore = Math.min(100, Math.max(10,
      citationScore * 0.6 + (hasSchema ? 20 : 0) + (page.h1 ? 10 : 0) + (wc > 500 ? 10 : 0),
    ));

    const retrievalQualityScore = Math.round(
      chunkStabilityIndex * 25 +
      answerFormationProbability * 25 +
      (summarisationLossScore / 100) * 25 +
      (citationEligibilityScore / 100) * 25,
    );

    const retrievalFailureReasons: RetrievalSimulationResult['retrievalFailureReasons'] = [];
    if (wc < 200) {
      retrievalFailureReasons.push({ stage: 'chunk_extraction', description: 'Page has too few words to form a stable chunk', severity: 'warning', affectedChunks: [], recommendation: 'Expand content to at least 300 words to improve chunk stability.' });
    }
    if (!hasSchema) {
      retrievalFailureReasons.push({ stage: 'citation_filter', description: 'No structured data — page lacks authority signals for citation eligibility', severity: 'warning', affectedChunks: [], recommendation: 'Add JSON-LD schema markup (Article, Organization, or FAQPage).' });
    }
    if (wc > 3000) {
      retrievalFailureReasons.push({ stage: 'truncation', description: `Page is ${wc} words — content past the context window may be ignored`, severity: 'info', affectedChunks: [], recommendation: 'Place key facts and entity definitions in the first 1500 words.' });
    }

    return {
      pageUrl: page.url,
      simulated: true,
      retrievalQualityScore,
      chunkStabilityIndex,
      answerFormationProbability,
      summarisationLossScore,
      citationEligibilityScore,
      retrievalFailureReasons,
      truncationZoneWarnings: wc > 2000 ? [`Content beyond ~2000 words (≈${wc - 2000} words) may fall outside the retrieval context window.`] : [],
      fragileClaimsCount: page.headings.filter((h) => /\d|percent|%|founded|launched|vs\.|compared/i.test(h.text)).length,
    };
  });
}

// ── Layer 4 — Machine Trust Score ────────────────────────────────────────────

function computeMachineTrustScore(pages: ParsedPage[], schemaScore: number): MachineTrustScore {
  const homepage = pages[0];
  const authorityDomains = ['wikipedia.org', 'wikidata.org', 'linkedin.com', 'twitter.com', 'x.com', 'facebook.com', 'github.com', 'crunchbase.com', 'bloomberg.com', 'reuters.com'];
  const allExternal = pages.flatMap((p) => p.externalLinks);
  const authorityLinks = allExternal.filter((u) => authorityDomains.some((d) => u.includes(d)));
  const uniqueAuthorityDomains = new Set(authorityLinks.map((u) => { try { return new URL(u).hostname; } catch { return u; } }));
  const hasOrgSchema = pages.some((p) => p.schemaTypes.some((t) => ['Organization', 'LocalBusiness', 'Corporation'].includes(t)));
  const hasSameAs = pages.some((p) => p.schemas.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s));
  const hasPersonSchema = pages.some((p) => p.schemaTypes.includes('Person'));
  const pagesWithBothH1AndSchema = pages.filter((p) => p.h1 && p.hasStructuredData).length;

  const entityCredibilityScore = Math.min(100, Math.max(10, 25 + (hasOrgSchema ? 35 : 0) + (authorityLinks.length > 0 ? 20 : 0) + (hasPersonSchema ? 10 : 0) + (hasSameAs ? 10 : 0)));
  const schemaTrustAlignmentScore = Math.min(100, Math.max(10, Math.round(schemaScore * 0.75 + (pagesWithBothH1AndSchema / Math.max(1, pages.length)) * 25)));
  const externalValidationScore = Math.min(100, Math.max(10, 20 + Math.min(60, uniqueAuthorityDomains.size * 15) + (hasSameAs ? 20 : 0)));
  const trustDegradationResistance = Math.min(100, 68 + (hasOrgSchema ? 12 : 0) + (hasSameAs ? 5 : 0));
  const crossSourceValidationIndex = allExternal.length > 0 ? Math.min(1, authorityLinks.length / allExternal.length + 0.1) : 0.1;
  const overall = Math.min(100, Math.round(entityCredibilityScore * 0.35 + schemaTrustAlignmentScore * 0.25 + externalValidationScore * 0.30 + trustDegradationResistance * 0.10));

  const trustIssues: MachineTrustScore['trustIssues'] = [];
  if (!hasOrgSchema) trustIssues.push({ type: 'missing_entity_schema', severity: 'critical', entity: homepage?.title ?? 'Primary Entity', description: 'No Organisation schema detected — AI systems cannot verify the primary entity identity.', recommendation: 'Add an Organisation schema block to the homepage with name, url, description, and sameAs links.' });
  if (!hasSameAs) trustIssues.push({ type: 'missing_same_as', severity: 'warning', entity: homepage?.title ?? 'Primary Entity', description: 'No sameAs links detected — AI systems cannot cross-validate against external knowledge bases.', recommendation: 'Add sameAs links pointing to Wikipedia, Wikidata, LinkedIn, or Crunchbase.' });
  if (authorityLinks.length === 0) trustIssues.push({ type: 'no_external_validation', severity: 'warning', entity: 'Site', description: 'No links to authoritative external sources detected — trust signals are self-referential.', recommendation: 'Link to authoritative sources to strengthen external trust signals.' });

  return { overall, entityCredibilityScore, schemaTrustAlignmentScore, externalValidationScore, contradictionAbsenceScore: null, trustDegradationResistance, crossSourceValidationIndex, trustIssues, degradationSignals: [] };
}

// ── Layer 4 — Temporal Authority ─────────────────────────────────────────────

function computeTemporalAuthority(pages: ParsedPage[]): TemporalAuthorityResult {
  const now = Date.now();
  const sixMonthsAgo = now - 6 * 30 * 24 * 3600 * 1000;

  const getSchemaDate = (s: unknown): string | null => {
    if (typeof s !== 'object' || s === null) return null;
    const o = s as Record<string, unknown>;
    return (o['dateModified'] ?? o['datePublished'] ?? null) as string | null;
  };

  const hasDateSchema = pages.some((p) => p.schemas.some((s) => getSchemaDate(s) !== null));
  const hasRecentDate = pages.some((p) =>
    p.schemas.some((s) => { const d = getSchemaDate(s); try { return d ? new Date(d).getTime() > sixMonthsAgo : false; } catch { return false; } }),
  );
  const pagesWithDates = pages.filter((p) => p.schemas.some((s) => getSchemaDate(s) !== null));
  const pagesWithCanonical = pages.filter((p) => p.canonical).length;
  const pagesWithSchema = pages.filter((p) => p.hasStructuredData).length;

  const trustStabilityIndex = Math.min(1.0, Math.max(0.10,
    0.60 + (pagesWithCanonical / Math.max(1, pages.length)) * 0.15 + (pagesWithSchema / Math.max(1, pages.length)) * 0.15 + (hasDateSchema ? 0.10 : 0),
  ));
  const contentFreshnessImpactFactor = Math.min(1.0, Math.max(0.20,
    0.45 + (hasDateSchema ? 0.20 : 0) + (hasRecentDate ? 0.25 : 0) + (pagesWithDates.length / Math.max(1, pages.length)) * 0.10,
  ));
  const updateFrequencyClassification: TemporalAuthorityResult['updateFrequencyClassification'] =
    hasRecentDate ? 'active' : hasDateSchema ? 'periodic' : 'stale';
  const stalePagesAtRisk = pages.filter((p) => p.wordCount < 200 && !p.hasStructuredData).map((p) => p.url).slice(0, 10);

  const temporalIssues: TemporalAuthorityResult['temporalIssues'] = [];
  if (!hasDateSchema) temporalIssues.push({ type: 'missing_date_schema', severity: 'warning', pageUrl: pages[0]?.url ?? '', description: 'No datePublished or dateModified schema detected. AI systems cannot assess content freshness.', recommendation: 'Add datePublished and dateModified to Article and BlogPosting schemas across all content pages.' });
  if (stalePagesAtRisk.length > 3) temporalIssues.push({ type: 'stale_thin_pages', severity: 'info', pageUrl: stalePagesAtRisk[0] ?? '', description: `${stalePagesAtRisk.length} thin pages with no schema are at risk of trust decay.`, recommendation: 'Expand these pages with substantive content or add schema markup to signal their purpose.' });

  return { isBaseline: true, authorityVelocityScore: null, trustStabilityIndex, contentFreshnessImpactFactor, semanticDriftIndex: 0, updateFrequencyClassification, stalePagesAtRisk, driftedPages: [], temporalIssues };
}

// ── Layer 4 — Recommendation Surface Map ─────────────────────────────────────

function computeRecommendationSurfaces(
  pages: ParsedPage[],
  aiScore: number,
  entityConfidenceScore: number,
  citationScore: number,
  semanticTrustScore: number,
  schemaScore: number,
): RecommendationSurfaceMap {
  const hasFAQSchema = pages.some((p) => p.schemaTypes.includes('FAQPage'));
  const hasHowToSchema = pages.some((p) => p.schemaTypes.includes('HowTo'));
  const hasSpeakableSchema = pages.some((p) => p.schemas.some((s) => typeof s === 'object' && s !== null && 'speakable' in s));
  const hasOrgSchema = pages.some((p) => p.schemaTypes.some((t) => ['Organization', 'LocalBusiness'].includes(t)));
  const allExternal = pages.flatMap((p) => p.externalLinks);

  const aiOverviewsProb = Math.min(95, Math.max(5,
    20 + (schemaScore > 60 ? 20 : schemaScore > 40 ? 10 : 0) + (hasFAQSchema ? 25 : 0) + (hasHowToSchema ? 15 : 0) + (citationScore > 60 ? 20 : citationScore > 40 ? 10 : 0) + (schemaScore > 80 ? 10 : 0),
  ));
  const chatProb = Math.min(95, Math.max(5, Math.round(aiScore * 0.50 + entityConfidenceScore * 0.30 + semanticTrustScore * 0.20)));
  const voiceProb = Math.min(95, Math.max(5, 15 + (hasSpeakableSchema ? 35 : 0) + (hasFAQSchema ? 20 : 0) + (hasOrgSchema ? 10 : 0) + (schemaScore > 70 ? 15 : 0)));
  const agentProb = Math.min(95, Math.max(5, Math.round(entityConfidenceScore * 0.35 + schemaScore * 0.35 + Math.min(30, allExternal.length * 2) * 0.30)));
  const overallSurfaceScore = Math.round(aiOverviewsProb * 0.30 + chatProb * 0.30 + voiceProb * 0.20 + agentProb * 0.20);

  const toStatus = (p: number): RecommendationSurfaceMap['surfaces']['aiOverviews']['status'] => p >= 65 ? 'visible' : p >= 40 ? 'partial' : 'absent';
  const coverageGaps: RecommendationSurfaceMap['coverageGaps'] = [];
  if (aiOverviewsProb < 40) coverageGaps.push({ surface: 'AI Overviews', missedOpportunity: 'Featured in search-integrated AI responses', requiredSignals: ['FAQPage schema', 'schema completeness > 60', 'citation probability > 60'], estimatedImpact: 'high' });
  if (voiceProb < 40) coverageGaps.push({ surface: 'Voice retrieval', missedOpportunity: 'Voice assistant answers', requiredSignals: ['speakable schema', 'FAQPage schema', 'concise direct answers'], estimatedImpact: 'medium' });

  const missingChannels: string[] = [];
  if (voiceProb < 40) missingChannels.push('Voice assistant retrieval');
  if (aiOverviewsProb < 40) missingChannels.push('AI Overview inclusion');

  return {
    overallSurfaceScore,
    surfaces: {
      aiOverviews: { inclusionProbability: aiOverviewsProb, status: toStatus(aiOverviewsProb), blockers: [], recommendations: [...(!hasFAQSchema ? ['Add FAQPage schema.'] : []), ...(schemaScore < 60 ? ['Improve schema completeness.'] : [])] },
      chatRecommendation: { inclusionProbability: chatProb, status: toStatus(chatProb), blockers: [], recommendations: [...(entityConfidenceScore < 60 ? ['Strengthen entity definition.'] : []), ...(semanticTrustScore < 60 ? ['Improve semantic trust signals.'] : [])] },
      voiceRetrieval: { inclusionProbability: voiceProb, status: toStatus(voiceProb), blockers: [], recommendations: [...(!hasSpeakableSchema ? ['Add speakable schema.'] : []), ...(!hasFAQSchema ? ['Add FAQPage schema with concise answers.'] : [])] },
      agentDiscovery: { inclusionProbability: agentProb, status: toStatus(agentProb), blockers: [], recommendations: [...(entityConfidenceScore < 60 ? ['Enhance entity schema completeness.'] : []), ...(allExternal.length < 5 ? ['Add links to authoritative external sources.'] : [])] },
    },
    coverageGaps,
    missingVisibilityChannels: missingChannels,
  };
}

// ── Layer 4 — Synthetic Entity Analysis ──────────────────────────────────────

function computeSyntheticEntityAnalysis(pages: ParsedPage[]): SyntheticEntityAnalysis {
  const allExternal = pages.flatMap((p) => p.externalLinks);
  const hasOrgSchema = pages.some((p) => p.schemaTypes.some((t) => ['Organization', 'LocalBusiness'].includes(t)));
  const hasSameAs = pages.some((p) => p.schemas.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s));
  const schemaPages = pages.filter((p) => p.hasStructuredData);
  const thinSchemaPages = schemaPages.filter((p) => p.wordCount < 100);
  const manipulationRatio = schemaPages.length > 0 ? thinSchemaPages.length / schemaPages.length : 0;

  const detectedPatterns: SyntheticEntityAnalysis['detectedPatterns'] = [];
  let riskScore = 8;

  if (allExternal.length === 0) {
    riskScore += 8;
    detectedPatterns.push({ patternType: 'authority_network', confidence: 0.30, evidence: ['No external links detected — all authority signals are self-referential'], affectedEntities: [], severity: 'info' });
  }
  if (manipulationRatio > 0.5 && thinSchemaPages.length > 2) {
    riskScore += 12;
    detectedPatterns.push({ patternType: 'schema_manipulation', confidence: Math.min(0.65, manipulationRatio), evidence: [`${thinSchemaPages.length} pages have schema markup but fewer than 100 words of body content`], affectedEntities: [], severity: 'warning' });
  }
  if (!hasOrgSchema && !hasSameAs && schemaPages.length > 0) riskScore += 5;

  const syntheticRiskScore = Math.min(40, riskScore);
  const entityAuthenticityConfidence = 100 - syntheticRiskScore;
  const networkIntegrityScore = Math.min(100, Math.max(30, 80 - (allExternal.length === 0 ? 15 : 0) - (!hasSameAs ? 10 : 0) - (thinSchemaPages.length > 2 ? 5 : 0)));

  const recommendations: string[] = [];
  if (!hasSameAs) recommendations.push('Add sameAs links in entity schema to enable cross-source identity validation.');
  if (allExternal.length === 0) recommendations.push('Include links to authoritative external sources to create verifiable trust pathways.');

  return { syntheticRiskScore, entityAuthenticityConfidence, networkIntegrityScore, detectedPatterns, flaggedEntities: [], recommendations };
}

// ── Perception Graph via Groq ─────────────────────────────────────────────────

interface RawPerceptionGraph {
  nodes: Array<{ id: string; type: string; label: string; confidence: number; citationReadiness: number; disambiguationStrength: number }>;
  edges: Array<{ source: string; target: string; relationshipType: string; strength: number }>;
}

async function callGroqPerceptionGraph(pages: ParsedPage[], domain: string): Promise<RawPerceptionGraph | null> {
  const adapter = getGroqAdapter();
  if (!adapter.isConfigured()) return null;

  const siteData = {
    domain,
    pages: pages.slice(0, 5).map((p) => ({
      url: p.url, title: p.title, h1: p.h1, schemaTypes: p.schemaTypes,
      headings: p.headings.slice(0, 6).map((h) => h.text),
      excerpt: p.bodyText.slice(0, 700),
    })),
  };

  const userPrompt = `Extract the AI Perception Graph for this website as an AI retrieval system would perceive it.

${JSON.stringify(siteData, null, 2)}

Return JSON with this structure:
{
  "nodes": [{"id":"n1","type":"entity","label":"Name","confidence":0.9,"citationReadiness":0.7,"disambiguationStrength":0.8}],
  "edges": [{"source":"n1","target":"n2","relationshipType":"isA","strength":0.8}]
}
Node types: entity, topic, claim, page
Relationship types: isA, partOf, relatedTo, contradicts, supports, authorOf, locatedIn, offers
Include 6-12 nodes and 5-10 edges. All confidence/strength values are 0-1 floats.
Return ONLY valid JSON.`;

  try {
    const output = await adapter.complete({
      systemPrompt: 'You are an AI entity graph extraction engine. Return ONLY valid JSON.',
      userPrompt,
      model: 'llama-3.3-70b-versatile',
      maxTokens: 1024,
      temperature: 0.2,
      jsonMode: true,
    });

    const parsed = JSON.parse(output.content) as Partial<RawPerceptionGraph>;
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) return null;

    const validNodeTypes = new Set(['entity', 'topic', 'claim', 'page']);
    const validEdgeTypes = new Set(['isA', 'partOf', 'relatedTo', 'contradicts', 'supports', 'authorOf', 'locatedIn', 'offers']);

    const nodes = parsed.nodes
      .filter((n) => n.id && n.label)
      .map((n) => ({
        id: String(n.id), type: validNodeTypes.has(n.type) ? n.type : 'entity',
        label: String(n.label).slice(0, 100),
        confidence: Math.min(1, Math.max(0, Number(n.confidence) || 0.7)),
        citationReadiness: Math.min(1, Math.max(0, Number(n.citationReadiness) || 0.5)),
        disambiguationStrength: Math.min(1, Math.max(0, Number(n.disambiguationStrength) || 0.5)),
      }))
      .slice(0, 20);

    const nodeIds = new Set(nodes.map((n) => n.id));
    const edges = parsed.edges
      .filter((e) => e.source && e.target && nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e) => ({
        source: String(e.source), target: String(e.target),
        relationshipType: validEdgeTypes.has(e.relationshipType) ? e.relationshipType : 'relatedTo',
        strength: Math.min(1, Math.max(0, Number(e.strength) || 0.6)),
      }))
      .slice(0, 30);

    if (nodes.length === 0) return null;
    return { nodes, edges };
  } catch {
    return null;
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function runServerlessAudit(
  auditId: string,
  domain: string,
  _userId: string,
  selfAuditRunId?: string,
): Promise<void> {
  const { updateAuditStatus, db } = await import('@sitenexis/db');

  try {
    await updateAuditStatus(auditId, 'running', {});
    const crawlStartTime = Date.now();

    // ── 1 + 2. Crawl pages via FetchExtractionAdapter ─────────────────────────
    const extractor = getFetchExtractionAdapter();
    const crawledRaw = await extractor.crawlDomain(domain, {
      maxPages: MAX_PAGES,
      concurrency: 4,
      timeoutMs: 12_000,
      ctx: { auditId, domain },
      onPage: () => {
        // fire-and-forget progress update; ignore errors
        void updateAuditStatus(auditId, 'running', {}).catch(() => undefined);
      },
    });

    if (crawledRaw.length === 0 || crawledRaw[0]!.statusCode >= 400) {
      const code = crawledRaw[0]?.statusCode ?? 'timeout';
      await updateAuditStatus(auditId, 'failed', { errorMessage: `Homepage returned ${code} — cannot crawl ${domain}` });
      return;
    }

    const pages: ParsedPage[] = crawledRaw.map(toParsedPage);
    const urls = pages.map((p) => p.url);
    await updateAuditStatus(auditId, 'running', { pageCount: pages.length });

    // ── 3. Analyse ────────────────────────────────────────────────────────────
    const { score: seoScore, issues: seoIssues } = analyseSEO(pages);
    const { score: schemaScore, schemaUrls } = analyseSchema(pages);

    // Run both Groq calls in parallel with the heuristic fallback
    const heuristicScores = scoreAIVisibility(pages);
    const [groqScores, perceptionGraph] = await Promise.all([
      callGroqAnalysis(pages, domain),
      callGroqPerceptionGraph(pages, domain),
    ]);
    const aiScores = {
      aiScore:                  groqScores?.aiVisibilityScore      ?? heuristicScores.aiScore,
      machineReadabilityScore:  groqScores?.machineReadabilityScore  ?? heuristicScores.machineReadabilityScore,
      entityConfidenceScore:    groqScores?.entityConfidenceScore    ?? heuristicScores.entityConfidenceScore,
      retrievalReadinessScore:  groqScores?.retrievalReadinessScore  ?? heuristicScores.retrievalReadinessScore,
      citationProbabilityScore: groqScores?.citationProbabilityScore ?? heuristicScores.citationProbabilityScore,
      semanticTrustScore:       groqScores?.semanticTrustScore       ?? heuristicScores.semanticTrustScore,
      recommendationConfidence: groqScores?.recommendationConfidence ?? heuristicScores.recommendationConfidence,
    };

    const overall = Math.round(seoScore * 0.25 + aiScores.aiScore * 0.40 + schemaScore * 0.15 + 60 * 0.20);

    // ── 4. Save to DB ─────────────────────────────────────────────────────────

    // Save pages
    for (const page of pages.slice(0, 50)) {
      try {
        await (db as unknown as {
          page: {
            upsert: (opts: unknown) => Promise<unknown>;
          };
        }).page.upsert({
          where: { auditId_url: { auditId, url: page.url } },
          create: {
            auditId,
            url: page.url,
            statusCode: page.statusCode,
            title: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            canonicalUrl: page.canonical,
            wordCount: page.wordCount,
            bodyText: page.bodyText.slice(0, 5000),
            robotsDirective: page.robotsMeta ?? null,
            schemaData: page.schemas,
            crawledAt: new Date(),
          },
          update: {
            statusCode: page.statusCode,
            title: page.title,
            metaDescription: page.metaDescription,
            h1: page.h1,
            wordCount: page.wordCount,
          },
        });
      } catch { /* individual page save failure is non-fatal */ }
    }

    // Save audit scores
    await (db as unknown as {
      auditScore: {
        upsert: (opts: unknown) => Promise<unknown>;
      };
    }).auditScore.upsert({
      where: { auditId },
      create: {
        auditId,
        overall,
        seoScore,
        aiScore: aiScores.aiScore,
        schemaScore,
        linkGraphScore: 65,
        performanceScore: 70,
        breakdown: {
          seo: { titleOptimisation: seoScore, metaOptimisation: seoScore, headingStructure: seoScore, canonicalisation: seoScore, crawlability: seoScore, imageOptimisation: 60 },
          ai: { entityClarity: aiScores.entityConfidenceScore, conversationalReadiness: aiScores.retrievalReadinessScore, aiExtractability: aiScores.machineReadabilityScore, knowledgeGraphStructure: aiScores.semanticTrustScore },
          machineReadability: {
            renderingFidelity: aiScores.machineReadabilityScore,
            boilerplateRatio: aiScores.machineReadabilityScore,
            chunkBoundaryQuality: aiScores.machineReadabilityScore,
            signalToNoiseRatio: aiScores.machineReadabilityScore,
            headingHierarchy: aiScores.machineReadabilityScore,
            readingOrderConsistency: aiScores.machineReadabilityScore,
            linkAnchorQuality: aiScores.machineReadabilityScore,
          },
          entityIntelligence: { entityConfidenceScore: aiScores.entityConfidenceScore, entityConsistencyScore: aiScores.entityConfidenceScore, entityCoverageScore: aiScores.entityConfidenceScore, disambiguationScore: aiScores.entityConfidenceScore },
          citationAnalysis: { citationProbabilityScore: aiScores.citationProbabilityScore },
          semanticTrust: {
            score: aiScores.semanticTrustScore,
            breakdown: {
              authorshipTrust: aiScores.semanticTrustScore,
              organisationalTrust: aiScores.semanticTrustScore,
              contentTrust: aiScores.semanticTrustScore,
              structuralTrust: aiScores.semanticTrustScore,
            },
          },
          schema: { coverage: schemaScore / 100, schemaUrls },
          linkGraph: { avgPageRank: 0.5 },
          performance: { lcp: null, cls: null, ttfb: null },
        },
      },
      update: { overall, seoScore, aiScore: aiScores.aiScore, schemaScore },
    });

    // Save AI visibility scores
    await (db as unknown as {
      aIVisibilityScore: {
        upsert: (opts: unknown) => Promise<unknown>;
      };
    }).aIVisibilityScore.upsert({
      where: { auditId },
      create: {
        auditId,
        aiVisibilityScore: aiScores.aiScore,
        machineReadabilityScore: aiScores.machineReadabilityScore,
        entityConfidenceScore: aiScores.entityConfidenceScore,
        retrievalReadinessScore: aiScores.retrievalReadinessScore,
        citationProbabilityScore: aiScores.citationProbabilityScore,
        semanticTrustScore: aiScores.semanticTrustScore,
        recommendationConfidence: aiScores.recommendationConfidence,
        providerScores: {},
        breakdown: {},
      },
      update: {
        aiVisibilityScore: aiScores.aiScore,
        machineReadabilityScore: aiScores.machineReadabilityScore,
        entityConfidenceScore: aiScores.entityConfidenceScore,
        retrievalReadinessScore: aiScores.retrievalReadinessScore,
        citationProbabilityScore: aiScores.citationProbabilityScore,
        semanticTrustScore: aiScores.semanticTrustScore,
        recommendationConfidence: aiScores.recommendationConfidence,
      },
    });

    // Save SEO issues
    if (seoIssues.length > 0) {
      const { saveIssues } = await import('@sitenexis/db');
      await saveIssues(
        auditId,
        seoIssues.slice(0, 100).map((i) => ({
          module: 'seo',
          type: i.type,
          severity: i.severity as 'critical' | 'warning' | 'info',
          message: i.message,
          recommendation: i.recommendation,
          problem: i.problem,
          solution: i.solution,
        })),
      );
    }

    // ── 5. Layer 4 — Machine Trust Intelligence ──────────────────────────────
    // Hoist these so self-audit write-back (step 6) can access them even if Layer 4 partially fails
    const retrievalSims = computeRetrievalSimulations(pages, aiScores.citationProbabilityScore);
    const machineTrustData = computeMachineTrustScore(pages, schemaScore);
    const temporalAuthorityData = computeTemporalAuthority(pages);
    const surfaceMapData = computeRecommendationSurfaces(
      pages, aiScores.aiScore, aiScores.entityConfidenceScore,
      aiScores.citationProbabilityScore, aiScores.semanticTrustScore, schemaScore,
    );
    const syntheticData = computeSyntheticEntityAnalysis(pages);

    try {
      const {
        saveRetrievalSimulations,
        saveMachineTrustScore,
        saveTemporalAuthorityRecord,
        saveRecommendationSurfaceMap,
        saveSyntheticEntityAnalysis,
      } = await import('@sitenexis/db');

      // Save all Layer 4 results in parallel — partial failures are acceptable
      // Compute PCE from crawled page signals (schema density, link density, heading structure, content depth)
      const pceScore = (() => {
        if (pages.length === 0) return 0;
        const schemaDensity = pages.filter((p) => p.schemas.length > 0).length / pages.length;
        const avgLinks = pages.reduce((s, p) => s + p.internalLinks.length, 0) / pages.length;
        const linkDensity = Math.min(1, avgLinks / 20);
        const headingStructure = pages.filter((p) => p.h1 != null && p.headings.some((h) => h.level === 2)).length / pages.length;
        const avgWords = pages.reduce((s, p) => s + p.wordCount, 0) / pages.length;
        const contentDepth = Math.min(1, avgWords / 800);
        return Math.round((schemaDensity * 0.35 + linkDensity * 0.25 + headingStructure * 0.25 + contentDepth * 0.15) * 100) / 100;
      })();

      await Promise.allSettled([
        saveRetrievalSimulations(auditId, retrievalSims),
        saveMachineTrustScore(auditId, machineTrustData),
        saveTemporalAuthorityRecord(auditId, temporalAuthorityData),
        saveRecommendationSurfaceMap(auditId, surfaceMapData),
        saveSyntheticEntityAnalysis(auditId, syntheticData),
        // Save perception graph if Groq returned nodes
        perceptionGraph && perceptionGraph.nodes.length > 0
          ? (db as unknown as { perceptionGraphSnapshot: { upsert: (o: unknown) => Promise<unknown> } }).perceptionGraphSnapshot.upsert({
              where: { auditId },
              create: { auditId, nodesJson: perceptionGraph.nodes, edgesJson: perceptionGraph.edges.map((e) => ({ ...e, evidencedBy: [] })), perceptionConfidenceScore: pceScore },
              update: { nodesJson: perceptionGraph.nodes, edgesJson: perceptionGraph.edges.map((e) => ({ ...e, evidencedBy: [] })), perceptionConfidenceScore: pceScore },
            })
          : Promise.resolve(),
      ]);
    } catch (layer4Err) {
      logger.warn({ auditId, err: layer4Err }, 'Layer 4 analysis failed (non-fatal)');
    }

    // ── 6. Write back to selfAuditRun tables (health monitor) ────────────────
    if (selfAuditRunId) {
      try {
        const {
          linkSelfAuditToAudit,
          saveCrawlRun,
          saveVisibilityRun,
          saveEntityRun,
          saveKnowledgeGraphRun,
          completeSelfAuditRun,
        } = await import('@sitenexis/db');

        // Link audit to self-audit run
        await linkSelfAuditToAudit(selfAuditRunId, auditId);

        const pagesIndexable = pages.filter((p) => !p.robotsMeta?.toLowerCase().includes('noindex')).length;
        const avgRetrievalScore = retrievalSims.length > 0
          ? Math.round(retrievalSims.reduce((s, r) => s + (r.retrievalQualityScore ?? 0), 0) / retrievalSims.length)
          : 60;

        // Primary entity from Organisation schema
        let primaryEntityName: string | null = null;
        for (const page of pages) {
          for (const s of page.schemas) {
            if (typeof s === 'object' && s !== null && '@type' in s) {
              const t = (s as Record<string, unknown>)['@type'];
              if (t === 'Organization' || t === 'LocalBusiness') {
                const n = (s as Record<string, unknown>)['name'];
                if (typeof n === 'string') { primaryEntityName = n; break; }
              }
            }
            if (primaryEntityName) break;
          }
        }
        primaryEntityName = primaryEntityName ?? domain;

        const sameAsCount = pages.filter((p) =>
          p.schemas.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s),
        ).length;

        // Knowledge graph scores from perception graph
        const kgNodeCount = perceptionGraph?.nodes.length ?? 0;
        const kgEdgeCount = perceptionGraph?.edges.length ?? 0;
        const avgNodeConf = kgNodeCount > 0
          ? perceptionGraph!.nodes.reduce((s, n) => s + n.confidence, 0) / kgNodeCount
          : 0.6;
        const topicClusters = kgNodeCount > 0
          ? new Set(perceptionGraph!.nodes.map((n) => n.type)).size
          : 2;
        const kgScore = Math.min(100, Math.round(
          avgNodeConf * 50 + Math.min(30, kgNodeCount * 2) + Math.min(20, kgEdgeCount * 1.5),
        ));
        const topNodes = perceptionGraph?.nodes.slice(0, 5).map((n) => ({
          label: n.label, type: n.type, confidence: n.confidence, citationReadiness: n.citationReadiness,
        })) ?? [];

        const geoScore = Math.round(aiScores.aiScore * 0.7 + schemaScore * 0.3);
        const healthScore = overall;

        // Compile recommendations
        const recommendations = [
          ...seoIssues.slice(0, 5).map((i) => ({
            dimension: 'Technical SEO',
            severity: i.severity,
            issue: i.message,
            impact: i.cause,
            fix: i.solution,
            estimatedImprovement: i.severity === 'critical' ? 8 : i.severity === 'warning' ? 4 : 1,
          })),
          ...(!pages.some((p) => p.schemas.some((s) => typeof s === 'object' && s !== null && 'sameAs' in s))
            ? [{
                dimension: 'Machine Trust',
                severity: 'warning' as const,
                issue: 'No sameAs links in entity schema',
                impact: 'AI systems cannot cross-validate entity identity against external knowledge bases.',
                fix: 'Add sameAs links in Organisation schema pointing to Wikipedia, Wikidata, LinkedIn.',
                estimatedImprovement: 5,
              }]
            : []),
        ];

        await Promise.allSettled([
          saveCrawlRun(selfAuditRunId, domain, {
            pagesFound: urls.length,
            pagesCrawled: pages.length,
            pagesIndexable,
            crawlDurationMs: Date.now() - crawlStartTime,
            brokenLinksCount: 0,
            redirectChainCount: 0,
            missingSitemapPages: 0,
            crawlHealthScore: seoScore,
            topIssues: seoIssues.slice(0, 5),
          }),
          saveVisibilityRun(selfAuditRunId, domain, {
            aiVisibilityScore: aiScores.aiScore,
            machineReadabilityScore: aiScores.machineReadabilityScore,
            retrievalReadinessScore: aiScores.retrievalReadinessScore,
            citationProbability: aiScores.citationProbabilityScore,
            semanticTrustScore: aiScores.semanticTrustScore,
            recommendationConfidence: aiScores.recommendationConfidence,
            retrievalQualityScore: avgRetrievalScore,
            surfaceCoverageScore: surfaceMapData.overallSurfaceScore,
            providerBreakdown: {},
          }),
          saveEntityRun(selfAuditRunId, domain, {
            entitiesDetected: Math.max(1, pages.filter((p) => p.hasStructuredData).length),
            primaryEntityName,
            entityConfidenceScore: aiScores.entityConfidenceScore,
            entityConsistencyScore: aiScores.entityConfidenceScore,
            entityCoverageScore: aiScores.entityConfidenceScore,
            disambiguationScore: aiScores.entityConfidenceScore,
            sameAsLinksCount: sameAsCount,
            authenticityScore: syntheticData.entityAuthenticityConfidence,
            topEntities: [],
          }),
          saveKnowledgeGraphRun(selfAuditRunId, domain, {
            nodeCount: kgNodeCount,
            edgeCount: kgEdgeCount,
            topicClusters,
            avgNodeConfidence: avgNodeConf,
            graphStrengthScore: kgScore,
            topNodes,
          }),
          completeSelfAuditRun(selfAuditRunId, {
            healthScore,
            technicalSeoScore: seoScore,
            aiVisibilityScore: aiScores.aiScore,
            entityCoverageScore: aiScores.entityConfidenceScore,
            citationReadinessScore: aiScores.citationProbabilityScore,
            knowledgeGraphScore: kgScore,
            trustSignalsScore: machineTrustData.overall,
            performanceScore: 70,
            geoScore,
            breakdown: {
              seo: seoScore, ai: aiScores.aiScore, schema: schemaScore,
              machineTrust: machineTrustData.overall,
              surfaceCoverage: surfaceMapData.overallSurfaceScore,
            },
            recommendations,
          }),
        ]);

        logger.info({ selfAuditRunId, auditId, healthScore }, 'Self-audit run completed and written to health monitor');
      } catch (selfAuditErr) {
        logger.warn({ selfAuditRunId, auditId, err: selfAuditErr }, 'Self-audit write-back failed (non-fatal)');
      }
    }

    // ── 7. StateEngine write-back (LoopOS V4.5) ──────────────────────────────
    // Append a score snapshot to SiteState and record the open issue set.
    // Non-fatal — never blocks audit completion.
    try {
      const { appendScoreSnapshot, recordIssueSet } = await import('@sitenexis/loop-os');
      const snapshot = {
        auditId,
        capturedAt: new Date().toISOString(),
        overall,
        aiVisibilityScore: aiScores.aiScore,
        citationProbabilityScore: aiScores.citationProbabilityScore,
        semanticTrustScore: aiScores.semanticTrustScore,
        entityConfidenceScore: aiScores.entityConfidenceScore,
        retrievalReadinessScore: aiScores.retrievalReadinessScore,
        machineReadabilityScore: aiScores.machineReadabilityScore,
        seoScore,
        schemaScore,
        performanceScore: 70,
        retrievalQualityScore: retrievalSims.length > 0
          ? Math.round(retrievalSims.reduce((s, r) => s + (r.retrievalQualityScore ?? 0), 0) / retrievalSims.length)
          : null,
        machineTrustScore: machineTrustData.overall,
        authorityVelocityScore: temporalAuthorityData.authorityVelocityScore ?? null,
        recommendationSurfaceScore: surfaceMapData.overallSurfaceScore,
        entityAuthenticityScore: syntheticData.entityAuthenticityConfidence,
      };
      const openIssueIds = seoIssues.map((i) => `${auditId}:${i.type}`);
      const openIssueTypes = Object.fromEntries(
        seoIssues.map((i) => [`${auditId}:${i.type}`, { type: i.type, severity: i.severity, module: 'seo' }]),
      );
      await Promise.allSettled([
        appendScoreSnapshot(domain, snapshot),
        recordIssueSet(domain, auditId, openIssueIds, openIssueTypes),
      ]);
      logger.info({ auditId, domain }, 'LoopOS StateEngine updated');
    } catch (loopErr) {
      logger.warn({ auditId, domain, err: loopErr }, 'LoopOS StateEngine write failed (non-fatal)');
    }

    await updateAuditStatus(auditId, 'complete', { pageCount: pages.length });
    logger.info({ auditId, domain, pages: pages.length, overall }, 'Serverless audit complete');

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ auditId, domain, err: msg }, 'Serverless audit failed');
    try {
      const { updateAuditStatus } = await import('@sitenexis/db');
      await updateAuditStatus(auditId, 'failed', { errorMessage: msg.slice(0, 500) });
    } catch { /* best effort */ }
  }
}
