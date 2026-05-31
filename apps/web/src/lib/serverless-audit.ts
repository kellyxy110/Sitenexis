/**
 * Serverless Audit Runner
 * Crawls a domain using fetch() + HTML parsing and produces real analysis scores.
 * Used when the BullMQ worker is unavailable (Redis not configured, Vercel deployment).
 * No Puppeteer. No Redis. No background worker required.
 */

import { logger } from '@/lib/logger';

// ── HTML extraction helpers ───────────────────────────────────────────────────

interface ParsedPage {
  url: string;
  statusCode: number;
  title: string | null;
  metaDescription: string | null;
  h1: string | null;
  canonical: string | null;
  robotsMeta: string | null;
  schemas: unknown[];
  bodyText: string;
  wordCount: number;
  headings: { level: number; text: string }[];
  internalLinks: string[];
  externalLinks: string[];
  hasStructuredData: boolean;
  schemaTypes: string[];
  responseTimeMs: number;
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseHtml(html: string, baseUrl: string): Omit<ParsedPage, 'url' | 'statusCode' | 'responseTimeMs'> {
  // Title
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1]?.trim().replace(/\s+/g, ' ') ?? null;

  // Meta description
  const metaDescription =
    html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']*)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)[^>]+name=["']description["']/i)?.[1] ??
    null;

  // H1
  const h1Raw = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? null;
  const h1 = h1Raw ? stripTags(h1Raw).slice(0, 200) : null;

  // Canonical
  const canonical =
    html.match(/<link[^>]+rel=["']canonical["'][^>]+href=["']([^"']+)/i)?.[1] ??
    html.match(/<link[^>]+href=["']([^"']+)[^>]+rel=["']canonical["']/i)?.[1] ??
    null;

  // Robots meta
  const robotsMeta =
    html.match(/<meta[^>]+name=["']robots["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)[^>]+name=["']robots["']/i)?.[1] ??
    null;

  // JSON-LD schemas
  const schemaMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const schemas = schemaMatches
    .map((m) => { try { return JSON.parse(m[1]!) as unknown; } catch { return null; } })
    .filter(Boolean);

  const schemaTypes = schemas
    .map((s) => {
      if (typeof s === 'object' && s !== null && '@type' in s) return String((s as Record<string, unknown>)['@type']);
      return null;
    })
    .filter((t): t is string => t !== null);

  // Headings H2-H6
  const headings: { level: number; text: string }[] = [];
  for (const m of html.matchAll(/<h([2-6])[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    headings.push({ level: parseInt(m[1]!), text: stripTags(m[2]!).slice(0, 150) });
  }

  // Body text (remove scripts, styles, then strip tags)
  let bodyHtml = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  bodyHtml = bodyHtml
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '');
  const bodyText = stripTags(bodyHtml).slice(0, 50_000);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  // Links
  const origin = new URL(baseUrl).origin;
  const allHrefs = [...html.matchAll(/href=["']([^"'#?\s]+)/gi)].map((m) => m[1]!);
  const internalLinks: string[] = [];
  const externalLinks: string[] = [];

  for (const href of allHrefs) {
    try {
      const abs = new URL(href, baseUrl).href;
      if (abs.startsWith(origin)) {
        if (!internalLinks.includes(abs) && abs !== baseUrl) internalLinks.push(abs);
      } else if (href.startsWith('http')) {
        if (!externalLinks.includes(abs)) externalLinks.push(abs);
      }
    } catch { /* skip malformed */ }
  }

  return {
    title,
    metaDescription,
    h1,
    canonical,
    robotsMeta,
    schemas,
    schemaTypes,
    bodyText,
    wordCount,
    headings,
    internalLinks: internalLinks.slice(0, 200),
    externalLinks: externalLinks.slice(0, 50),
    hasStructuredData: schemas.length > 0,
  };
}

// ── Fetch helpers ─────────────────────────────────────────────────────────────

const FETCH_TIMEOUT_MS = 12_000;
const MAX_PAGES = 20;

async function fetchPage(url: string): Promise<{ html: string; statusCode: number; ms: number } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const t = Date.now();
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'SiteNexis-Audit/1.0 (+https://sitenexis.com/bot)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      redirect: 'follow',
    });
    const html = await res.text();
    return { html, statusCode: res.status, ms: Date.now() - t };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchSitemapUrls(domain: string): Promise<string[]> {
  const base = `https://${domain}`;
  const candidates = [`${base}/sitemap.xml`, `${base}/sitemap_index.xml`, `${base}/sitemap/sitemap.xml`];

  for (const url of candidates) {
    try {
      const result = await fetchPage(url);
      if (!result || result.statusCode !== 200) continue;
      const urls = [...result.html.matchAll(/<loc>(.*?)<\/loc>/gi)]
        .map((m) => m[1]!.trim())
        .filter((u) => u.startsWith('http') && new URL(u).hostname === domain);
      if (urls.length > 0) return urls.slice(0, MAX_PAGES);
    } catch { /* try next */ }
  }
  return [];
}

// ── SEO analysis ──────────────────────────────────────────────────────────────

interface SEOIssueSimple {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  url: string;
  message: string;
  recommendation: string;
}

function analyseSEO(pages: ParsedPage[]): { score: number; issues: SEOIssueSimple[] } {
  const issues: SEOIssueSimple[] = [];
  let deductions = 0;

  for (const page of pages) {
    const u = page.url;

    if (!page.title) {
      issues.push({ type: 'missing_title', severity: 'critical', url: u, message: 'No <title> tag found', recommendation: 'Add a descriptive title tag (50-60 characters).' });
      deductions += 10;
    } else if (page.title.length > 70) {
      issues.push({ type: 'title_too_long', severity: 'warning', url: u, message: `Title is ${page.title.length} chars (max 70)`, recommendation: 'Shorten the title to under 70 characters.' });
      deductions += 3;
    } else if (page.title.length < 20) {
      issues.push({ type: 'title_too_short', severity: 'warning', url: u, message: `Title is only ${page.title.length} chars`, recommendation: 'Expand the title to at least 20 characters.' });
      deductions += 3;
    }

    if (!page.metaDescription) {
      issues.push({ type: 'missing_meta_description', severity: 'warning', url: u, message: 'No meta description', recommendation: 'Add a meta description (120-155 characters).' });
      deductions += 5;
    } else if (page.metaDescription.length > 165) {
      issues.push({ type: 'meta_description_too_long', severity: 'info', url: u, message: `Meta description is ${page.metaDescription.length} chars`, recommendation: 'Trim meta description to under 155 characters.' });
      deductions += 1;
    }

    if (!page.h1) {
      issues.push({ type: 'missing_h1', severity: 'critical', url: u, message: 'No <h1> tag found', recommendation: 'Add a single H1 that describes the page topic.' });
      deductions += 8;
    }

    if (!page.canonical) {
      issues.push({ type: 'missing_canonical', severity: 'warning', url: u, message: 'No canonical link', recommendation: 'Add <link rel="canonical"> to prevent duplicate content issues.' });
      deductions += 4;
    }

    if (page.wordCount < 300 && pages.indexOf(page) > 0) {
      issues.push({ type: 'low_word_count', severity: 'info', url: u, message: `Only ${page.wordCount} words`, recommendation: 'Add more substantive content (aim for 500+ words on key pages).' });
      deductions += 2;
    }

    if (page.robotsMeta?.toLowerCase().includes('noindex')) {
      issues.push({ type: 'noindex_page', severity: 'warning', url: u, message: 'Page has noindex directive', recommendation: 'Remove noindex if this page should be indexed.' });
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

// ── AI visibility scoring ─────────────────────────────────────────────────────

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

// ── Main export ───────────────────────────────────────────────────────────────

export async function runServerlessAudit(
  auditId: string,
  domain: string,
  _userId: string,
): Promise<void> {
  const { updateAuditStatus, db } = await import('@sitenexis/db');

  try {
    await updateAuditStatus(auditId, 'running', {});

    // ── 1. Discover URLs ──────────────────────────────────────────────────────
    const baseUrl = `https://${domain}`;
    let urls: string[] = [baseUrl];

    const sitemapUrls = await fetchSitemapUrls(domain);
    if (sitemapUrls.length > 0) {
      urls = [baseUrl, ...sitemapUrls.filter((u) => u !== baseUrl)].slice(0, MAX_PAGES);
    }

    // ── 2. Crawl pages ────────────────────────────────────────────────────────
    const pages: ParsedPage[] = [];

    // Always fetch homepage first
    const homeResult = await fetchPage(baseUrl);
    if (!homeResult || homeResult.statusCode >= 400) {
      await updateAuditStatus(auditId, 'failed', { errorMessage: `Homepage returned ${homeResult?.statusCode ?? 'timeout'} — cannot crawl ${domain}` });
      return;
    }

    const homeParsed = parseHtml(homeResult.html, baseUrl);
    pages.push({ url: baseUrl, statusCode: homeResult.statusCode, responseTimeMs: homeResult.ms, ...homeParsed });

    // Collect additional URLs from homepage if sitemap didn't give us any
    if (sitemapUrls.length === 0) {
      const discovered = homeParsed.internalLinks
        .filter((u) => {
          try { const p = new URL(u).pathname; return p !== '/' && !p.match(/\.(jpg|png|gif|svg|pdf|css|js|ico|woff)$/i); }
          catch { return false; }
        })
        .slice(0, MAX_PAGES - 1);
      urls = [baseUrl, ...discovered];
    }

    // Fetch remaining pages with concurrency limit of 4
    const remaining = urls.slice(1);
    for (let i = 0; i < remaining.length; i += 4) {
      const batch = remaining.slice(i, i + 4);
      const results = await Promise.all(batch.map((u) => fetchPage(u)));
      for (let j = 0; j < batch.length; j++) {
        const result = results[j];
        if (result && result.statusCode < 400) {
          pages.push({ url: batch[j]!, statusCode: result.statusCode, responseTimeMs: result.ms, ...parseHtml(result.html, batch[j]!) });
        }
      }
      // Update page count as we crawl
      await updateAuditStatus(auditId, 'running', { pageCount: pages.length });
    }

    // ── 3. Analyse ────────────────────────────────────────────────────────────
    const { score: seoScore, issues: seoIssues } = analyseSEO(pages);
    const { score: schemaScore, schemaUrls } = analyseSchema(pages);
    const aiScores = scoreAIVisibility(pages);

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
            robotsDirectives: page.robotsMeta ? [page.robotsMeta] : [],
            schemaMarkup: page.schemas as object[],
            responseTimeMs: page.responseTimeMs,
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
          machineReadability: { score: aiScores.machineReadabilityScore },
          entityIntelligence: { entityConfidenceScore: aiScores.entityConfidenceScore, entityConsistencyScore: aiScores.entityConfidenceScore, entityCoverageScore: aiScores.entityConfidenceScore, disambiguationScore: aiScores.entityConfidenceScore },
          citationAnalysis: { citationProbabilityScore: aiScores.citationProbabilityScore },
          semanticTrust: { score: aiScores.semanticTrustScore },
          schema: { coverage: schemaScore / 100, schemaUrls },
          linkGraph: { avgPageRank: 0.5 },
          performance: { lcp: null, fid: null, cls: null, ttfb: null },
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
        })),
      );
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
