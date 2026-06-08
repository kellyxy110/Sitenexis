/**
 * AI Discovery Intelligence Engine
 *
 * Evaluates how quickly and effectively a website becomes discoverable by
 * AI systems and search engines. Separates indexing (Layer 1) from AI
 * awareness (Layer 3) — a page can be indexed in minutes but remain
 * invisible to AI retrieval systems for days or weeks.
 *
 * Does NOT duplicate existing SEO crawlability signals. Extends them with:
 * - Multi-path AI discovery assessment (direct crawlers, Bing, trained models)
 * - Estimated delay from publish to AI retrieval awareness
 * - Discovery Score (0–100) composite
 */

import type { CrawledPage, DiscoveryScore, AICrawlerAllowance, DiscoveryBottleneck } from '@sitenexis/shared';

// ─── AI crawler user-agent patterns ──────────────────────────────────────────

const AI_CRAWLERS: Record<keyof Omit<AICrawlerAllowance, 'allAllowed'>, RegExp> = {
  gptBot:         /GPTBot/i,
  claudeBot:      /ClaudeBot|anthropic-ai/i,
  perplexityBot:  /PerplexityBot/i,
  googleExtended: /Google-Extended/i,
  googleBot:      /Googlebot/i,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseRobotsAllowance(pages: CrawledPage[]): AICrawlerAllowance {
  // Look for a robots.txt page or infer from robotsDirective fields
  const robotsPage = pages.find(
    (p) => p.url.endsWith('/robots.txt') || p.url.includes('robots'),
  );
  const robotsText = robotsPage?.bodyText ?? '';

  // Also check per-page robotsDirectives fields
  const noindexCount = pages.filter(
    (p) => p.robotsDirectives.join(' ').toLowerCase().includes('noindex'),
  ).length;
  const allNoindex = noindexCount === pages.length && pages.length > 0;

  // Parse robots.txt disallow rules for each bot
  function isBotAllowed(pattern: RegExp): boolean {
    if (!robotsText) return true; // no robots.txt = allow all
    const lines = robotsText.split('\n').map((l) => l.trim().toLowerCase());
    let inRelevantBlock = false;
    let inAllBlock = false;

    for (const line of lines) {
      if (line.startsWith('user-agent:')) {
        const agent = line.replace('user-agent:', '').trim();
        inRelevantBlock = pattern.test(agent);
        inAllBlock = agent === '*';
      }
      if ((inRelevantBlock || inAllBlock) && line.startsWith('disallow: /')) {
        return false; // disallowed from root
      }
    }
    return !allNoindex;
  }

  const gptBot         = isBotAllowed(AI_CRAWLERS.gptBot);
  const claudeBot      = isBotAllowed(AI_CRAWLERS.claudeBot);
  const perplexityBot  = isBotAllowed(AI_CRAWLERS.perplexityBot);
  const googleExtended = isBotAllowed(AI_CRAWLERS.googleExtended);
  const googleBot      = isBotAllowed(AI_CRAWLERS.googleBot);

  return {
    gptBot,
    claudeBot,
    perplexityBot,
    googleExtended,
    googleBot,
    allAllowed: gptBot && claudeBot && perplexityBot && googleExtended && googleBot,
  };
}

function scoreCrawlAccessibility(pages: CrawledPage[]): number {
  if (pages.length === 0) return 0;

  let score = 100;
  const noindexPages = pages.filter(
    (p) => p.robotsDirectives.join(' ').toLowerCase().includes('noindex'),
  ).length;
  const noindexRatio = noindexPages / pages.length;

  if (noindexRatio > 0.5) score -= 30;
  else if (noindexRatio > 0.2) score -= 15;
  else if (noindexRatio > 0) score -= 5;

  // Check for canonical chains (self-referencing = good, missing = penalty)
  const missingCanonical = pages.filter((p) => !p.canonicalUrl).length;
  const missingRatio = missingCanonical / pages.length;
  if (missingRatio > 0.5) score -= 10;

  // Penalise for very slow response times (if available in metadata)
  const slowPages = pages.filter(
    (p) => (p.responseTimeMs ?? 0) > 5_000,
  ).length;
  if (slowPages > pages.length * 0.3) score -= 10;

  return Math.max(0, Math.round(score));
}

function scoreIndexability(pages: CrawledPage[]): number {
  if (pages.length === 0) return 0;

  let score = 100;

  // Check title tag presence
  const missingTitle = pages.filter((p) => !p.title || p.title.trim().length === 0).length;
  if (missingTitle > 0) score -= Math.min(20, missingTitle * 3);

  // Check meta description
  const missingMeta = pages.filter(
    (p) => !p.metaDescription || p.metaDescription.trim().length === 0,
  ).length;
  if (missingMeta > pages.length * 0.5) score -= 10;

  // H1 presence
  const missingH1 = pages.filter(
    (p) => !p.headings?.some((h) => h.level === 1),
  ).length;
  if (missingH1 > pages.length * 0.4) score -= 10;

  return Math.max(0, Math.round(score));
}

function scoreMultiSourceDiscovery(
  crawlerAllowance: AICrawlerAllowance,
  pages: CrawledPage[],
): number {
  let score = 0;

  // AI crawler allowances — highest impact (50 pts total)
  const crawlerChecks: (keyof Omit<AICrawlerAllowance, 'allAllowed'>)[] = [
    'gptBot', 'claudeBot', 'perplexityBot', 'googleExtended', 'googleBot',
  ];
  const allowedCount = crawlerChecks.filter((k) => crawlerAllowance[k]).length;
  score += Math.round((allowedCount / crawlerChecks.length) * 50);

  // Sitemap presence (15 pts)
  const hasSitemap = pages.some(
    (p) => p.url.includes('sitemap') || (p.schemaMarkup).length > 0,
  );
  if (hasSitemap) score += 15;

  // Schema markup (structural signal for AI discovery — 20 pts)
  const pagesWithSchema = pages.filter(
    (p) => (p.schemaMarkup).length > 0,
  ).length;
  const schemaRatio = pages.length > 0 ? pagesWithSchema / pages.length : 0;
  score += Math.round(schemaRatio * 20);

  // External links (discovery signal via link graph — 15 pts)
  const pagesWithExtLinks = pages.filter(
    (p) => (p.externalLinks ?? []).length > 0,
  ).length;
  if (pagesWithExtLinks > 0) score += 15;

  return Math.min(100, score);
}

function estimateDiscoveryDelayDays(
  crawlerAllowance: AICrawlerAllowance,
  pages: CrawledPage[],
  indexabilityScore: number,
): number {
  // Base delay for live retrieval systems (Perplexity, ChatGPT browsing): 3–14 days
  // Delay for knowledge-embedded models: months (not modelled — no actionable signal)
  let delay = 7; // baseline: 7 days for live retrieval discovery

  // AI crawlers blocked → can't enter the discovery pipeline at all
  const blockedCrawlers = [
    crawlerAllowance.gptBot,
    crawlerAllowance.claudeBot,
    crawlerAllowance.perplexityBot,
  ].filter((v) => !v).length;
  delay += blockedCrawlers * 5;

  // Poor indexability → slower Bing/Google discovery → slower AI Overview inclusion
  if (indexabilityScore < 40) delay += 7;
  else if (indexabilityScore < 60) delay += 3;

  // No schema → slower entity resolution → slower AI awareness
  const schemaPresent = pages.some((p) => (p.schemaMarkup).length > 0);
  if (!schemaPresent) delay += 3;

  // Established domain with many pages → faster re-crawl priority
  if (pages.length > 50) delay = Math.max(3, delay - 2);
  if (pages.length < 5) delay += 3;

  return Math.min(30, delay);
}

function buildBottlenecks(
  crawlerAllowance: AICrawlerAllowance,
  crawlScore: number,
  indexabilityScore: number,
  pages: CrawledPage[],
): DiscoveryBottleneck[] {
  const bottlenecks: DiscoveryBottleneck[] = [];

  const blockedBots = Object.entries(crawlerAllowance)
    .filter(([k, v]) => k !== 'allAllowed' && !v)
    .map(([k]) => k);

  if (blockedBots.length > 0) {
    bottlenecks.push({
      type: 'ai_crawler_blocked',
      severity: 'critical',
      description: `${blockedBots.join(', ')} ${blockedBots.length === 1 ? 'is' : 'are'} blocked by robots.txt or noindex directives.`,
      recommendation: 'Add explicit Allow directives for GPTBot, ClaudeBot, PerplexityBot, and Google-Extended in robots.txt.',
    });
  }

  if (crawlScore < 50) {
    bottlenecks.push({
      type: 'crawl_accessibility',
      severity: 'critical',
      description: 'More than half of crawled pages have crawlability issues (noindex, missing canonicals, slow load times).',
      recommendation: 'Audit noindex directives and ensure canonical tags are present on all indexable pages.',
    });
  }

  if (indexabilityScore < 60) {
    bottlenecks.push({
      type: 'indexability',
      severity: 'warning',
      description: 'Missing title tags, meta descriptions, or H1 headings on a significant number of pages.',
      recommendation: 'Ensure every page has a unique title tag, meta description, and a single H1 heading.',
    });
  }

  const noSchema = pages.every((p) => (p.schemaMarkup).length === 0);
  if (noSchema) {
    bottlenecks.push({
      type: 'missing_schema',
      severity: 'warning',
      description: 'No structured data detected. Schema markup accelerates AI entity resolution and discovery.',
      recommendation: 'Add Organisation, WebSite, and Article schema to core pages.',
    });
  }

  return bottlenecks;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeDiscovery(pages: CrawledPage[]): DiscoveryScore {
  if (pages.length === 0) {
    return {
      score: 0,
      estimatedDiscoveryDelayDays: 14,
      crawlAccessibilityScore: 0,
      indexabilityScore: 0,
      aiCrawlerAllowance: {
        gptBot: false, claudeBot: false, perplexityBot: false,
        googleExtended: false, googleBot: false, allAllowed: false,
      },
      multiSourceDiscoveryScore: 0,
      bottlenecks: [],
      accelerationOpportunities: [],
    };
  }

  const aiCrawlerAllowance    = parseRobotsAllowance(pages);
  const crawlAccessibilityScore  = scoreCrawlAccessibility(pages);
  const indexabilityScore        = scoreIndexability(pages);
  const multiSourceDiscoveryScore = scoreMultiSourceDiscovery(aiCrawlerAllowance, pages);
  const estimatedDiscoveryDelayDays = estimateDiscoveryDelayDays(
    aiCrawlerAllowance, pages, indexabilityScore,
  );

  // Composite Discovery Score
  const score = Math.round(
    crawlAccessibilityScore     * 0.25 +
    indexabilityScore           * 0.25 +
    multiSourceDiscoveryScore   * 0.30 +
    // Invert delay: shorter delay = higher score (capped component: 20 pts)
    Math.max(0, (30 - estimatedDiscoveryDelayDays) / 30 * 100) * 0.20,
  );

  const bottlenecks = buildBottlenecks(
    aiCrawlerAllowance, crawlAccessibilityScore, indexabilityScore, pages,
  );

  const accelerationOpportunities: string[] = [];
  if (!aiCrawlerAllowance.allAllowed) {
    accelerationOpportunities.push('Allow all AI crawlers in robots.txt to unlock direct-crawl discovery pathway.');
  }
  if (indexabilityScore < 80) {
    accelerationOpportunities.push('Improve title + meta description coverage to accelerate Bing and AI Overview discovery.');
  }
  if (!pages.some((p) => (p.schemaMarkup).length > 0)) {
    accelerationOpportunities.push('Add WebSite and Organisation schema to signal entity identity to AI discovery systems.');
  }
  if (estimatedDiscoveryDelayDays > 10) {
    accelerationOpportunities.push('Submit sitemap to Google Search Console and Bing Webmaster Tools to trigger faster crawl prioritisation.');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    estimatedDiscoveryDelayDays,
    crawlAccessibilityScore,
    indexabilityScore,
    aiCrawlerAllowance,
    multiSourceDiscoveryScore,
    bottlenecks,
    accelerationOpportunities,
  };
}
