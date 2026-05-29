import { type CrawledPage, type SEOIssue, type SEOScore } from '@sitenexis/shared';
import { calculateSEOScore } from './scoring';


export interface SEOAnalysisResult {
  score: SEOScore;
  issues: SEOIssue[];
  pageScores: Record<string, number>;
}

/**
 * Runs all SEO checks across a full crawl result and returns a scored report.
 *
 * @param pages      - Full array of crawled pages.
 * @param sitemapUrls - Optional: URL set from the parsed sitemap (for sitemap coverage checks).
 */
export function analyzeSEO(
  pages: CrawledPage[],
  sitemapUrls: string[] = []
): SEOAnalysisResult {
  const issues: SEOIssue[] = [];

  // Pre-build indexes for cross-page checks
  const titleIndex = buildTitleIndex(pages);
  const descriptionIndex = buildDescriptionIndex(pages);
  const canonicalIndex = buildCanonicalIndex(pages);
  const inboundLinksIndex = buildInboundLinksIndex(pages);
  const sitemapSet = new Set(sitemapUrls.map(normalizeUrl));

  for (const page of pages) {
    issues.push(
      ...checkTitle(page, titleIndex),
      ...checkMetaDescription(page, descriptionIndex),
      ...checkCanonical(page, canonicalIndex),
      ...checkRobotsIndexability(page, inboundLinksIndex, sitemapSet),
      ...checkStatusCode(page),
      ...checkRedirectChain(page),
      ...checkImages(page),
      ...checkInternalLinkAnchors(page),
    );
  }

  // Site-wide checks
  issues.push(
    ...checkSitemapCoverage(pages, sitemapSet),
    ...checkBrokenInternalLinks(pages),
  );

  const deduplicated = deduplicateIssues(issues);
  const sorted = sortIssues(deduplicated);
  const score = calculateSEOScore(sorted, pages.length, {
    hasValidSitemap: sitemapSet.size > 0,
  });

  const pageScores = computePageScores(pages, sorted);

  return { score, issues: sorted, pageScores };
}

// ─── Per-page checks ──────────────────────────────────────────────────────────

function checkTitle(page: CrawledPage, titleIndex: Map<string, string[]>): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (!page.title) {
    issues.push({
      type: 'missing_title',
      severity: 'critical',
      url: page.url,
      message: 'Page has no <title> tag.',
      recommendation: 'Add a descriptive <title> tag between 30–60 characters.',
    });
    return issues;
  }

  if (page.title.length < 30) {
    issues.push({
      type: 'title_too_short',
      severity: 'warning',
      url: page.url,
      message: `Title is only ${page.title.length} characters (minimum 30).`,
      recommendation: 'Expand the title to at least 30 characters to improve click-through rates.',
    });
  } else if (page.title.length > 60) {
    issues.push({
      type: 'title_too_long',
      severity: 'warning',
      url: page.url,
      message: `Title is ${page.title.length} characters (maximum 60).`,
      recommendation: 'Shorten the title to 30–60 characters to prevent truncation in SERPs.',
    });
  }

  const sharedUrls = titleIndex.get(page.title) ?? [];
  if (sharedUrls.length > 1) {
    issues.push({
      type: 'duplicate_title',
      severity: 'warning',
      url: page.url,
      message: `Title "${page.title.slice(0, 50)}" is shared with ${sharedUrls.length - 1} other page(s).`,
      recommendation: 'Each page should have a unique, descriptive title.',
    });
  }

  if (page.h1 && page.title.trim().toLowerCase() === page.h1.trim().toLowerCase()) {
    issues.push({
      type: 'duplicate_title',
      severity: 'info',
      url: page.url,
      message: 'Page title and H1 are identical.',
      recommendation: 'Vary the title and H1 slightly to target different keyword variants.',
    });
  }

  return issues;
}

function checkMetaDescription(
  page: CrawledPage,
  descriptionIndex: Map<string, string[]>
): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (!page.metaDescription) {
    issues.push({
      type: 'missing_meta_description',
      severity: 'warning',
      url: page.url,
      message: 'Page has no meta description.',
      recommendation: 'Add a unique meta description of 100–160 characters.',
    });
    return issues;
  }

  if (page.metaDescription.length < 100) {
    issues.push({
      type: 'missing_meta_description',
      severity: 'warning',
      url: page.url,
      message: `Meta description is only ${page.metaDescription.length} characters (minimum 100).`,
      recommendation: 'Expand the meta description to 100–160 characters.',
    });
  } else if (page.metaDescription.length > 160) {
    issues.push({
      type: 'meta_description_too_long',
      severity: 'warning',
      url: page.url,
      message: `Meta description is ${page.metaDescription.length} characters (maximum 160).`,
      recommendation: 'Shorten the meta description to 100–160 characters to prevent truncation.',
    });
  }

  const sharedUrls = descriptionIndex.get(page.metaDescription) ?? [];
  if (sharedUrls.length > 1) {
    issues.push({
      type: 'duplicate_meta_description',
      severity: 'warning',
      url: page.url,
      message: `Meta description is shared with ${sharedUrls.length - 1} other page(s).`,
      recommendation: 'Each page should have a unique meta description.',
    });
  }

  return issues;
}

function checkCanonical(
  page: CrawledPage,
  canonicalIndex: Map<string, string>
): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (!page.canonicalUrl) {
    issues.push({
      type: 'missing_canonical',
      severity: 'warning',
      url: page.url,
      message: 'Page has no canonical URL.',
      recommendation: 'Add a <link rel="canonical"> tag to prevent duplicate content indexing.',
    });
    return issues;
  }

  // Canonical pointing to a different domain
  try {
    const pageHost = new URL(page.url).hostname;
    const canonicalHost = new URL(page.canonicalUrl).hostname;
    if (pageHost !== canonicalHost) {
      issues.push({
        type: 'broken_canonical',
        severity: 'critical',
        url: page.url,
        message: `Canonical points to a different domain: ${canonicalHost}.`,
        recommendation: 'Ensure canonical URLs point to the same domain, or use absolute URLs correctly.',
      });
      return issues;
    }
  } catch {
    issues.push({
      type: 'broken_canonical',
      severity: 'critical',
      url: page.url,
      message: `Canonical URL is malformed: "${page.canonicalUrl}".`,
      recommendation: 'Fix the canonical URL to be a valid absolute URL.',
    });
    return issues;
  }

  // Canonical chain: this page's canonical points to another page that itself has a canonical
  const normalizedCanonical = normalizeUrl(page.canonicalUrl);
  const normalizedSelf = normalizeUrl(page.url);
  if (normalizedCanonical !== normalizedSelf) {
    const targetCanonical = canonicalIndex.get(normalizedCanonical);
    if (targetCanonical && normalizeUrl(targetCanonical) !== normalizedCanonical) {
      issues.push({
        type: 'broken_canonical',
        severity: 'warning',
        url: page.url,
        message: `Canonical chain detected: this page → ${page.canonicalUrl} → ${targetCanonical}.`,
        recommendation: 'Set canonical to the final destination URL directly to avoid canonical chains.',
      });
    }
  }

  return issues;
}

function checkRobotsIndexability(
  page: CrawledPage,
  inboundLinksIndex: Map<string, string[]>,
  sitemapSet: Set<string>
): SEOIssue[] {
  const issues: SEOIssue[] = [];
  const isNoindex = page.robotsDirectives.some((d) =>
    d.toLowerCase().includes('noindex')
  );

  if (isNoindex) {
    const inbound = inboundLinksIndex.get(normalizeUrl(page.url)) ?? [];
    if (inbound.length > 0) {
      issues.push({
        type: 'noindex_page',
        severity: 'warning',
        url: page.url,
        message: `Page has noindex directive but receives ${inbound.length} inbound internal link(s).`,
        recommendation: 'Remove the noindex directive or stop linking to this page internally.',
      });
    }

    if (sitemapSet.has(normalizeUrl(page.url))) {
      issues.push({
        type: 'noindex_page',
        severity: 'critical',
        url: page.url,
        message: 'Page is blocked by noindex but is present in the sitemap.',
        recommendation: 'Remove this URL from the sitemap or remove the noindex directive.',
      });
    }
  }

  return issues;
}

function checkStatusCode(page: CrawledPage): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (page.statusCode >= 400 && page.statusCode < 500) {
    issues.push({
      type: 'broken_internal_link',
      severity: 'critical',
      url: page.url,
      message: `Page returned ${page.statusCode} status code.`,
      recommendation: 'Fix or remove this page. Update all internal links pointing to it.',
    });
  }

  return issues;
}

function checkRedirectChain(page: CrawledPage): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (page.redirectChain.length > 2) {
    issues.push({
      type: 'redirect_chain',
      severity: 'warning',
      url: page.url,
      message: `Page has a redirect chain of ${page.redirectChain.length} hops.`,
      recommendation: 'Update internal links to point directly to the final destination URL.',
    });
  }

  return issues;
}

function checkImages(page: CrawledPage): SEOIssue[] {
  const issues: SEOIssue[] = [];
  const missing = page.images.filter((img) => !img.alt?.trim());

  if (missing.length > 0) {
    issues.push({
      type: 'missing_alt_text',
      severity: 'warning',
      url: page.url,
      message: `${missing.length} image(s) missing alt text.`,
      recommendation: 'Add descriptive alt text to all content images for accessibility and AI extractability.',
    });
  }

  return issues;
}

function checkInternalLinkAnchors(page: CrawledPage): SEOIssue[] {
  // We detect generic anchor text by re-parsing the page's link list.
  // The crawled page doesn't carry anchor text per link, so this check
  // is structural — flag the page if its outbound internal links
  // are only identifiable by URL pattern. Full anchor analysis is in the
  // link graph module which has access to the original HTML.
  // Here we handle the redirect URL variant: links in redirectChain != final URL.
  const issues: SEOIssue[] = [];

  if (page.redirectChain.length > 0) {
    issues.push({
      type: 'redirect_chain',
      severity: 'info',
      url: page.url,
      message: 'Page is linked via a redirect URL rather than the final destination.',
      recommendation: 'Update the source link to point directly to the canonical URL.',
    });
  }

  return issues;
}

// ─── Site-wide checks ─────────────────────────────────────────────────────────

function checkSitemapCoverage(
  pages: CrawledPage[],
  sitemapSet: Set<string>
): SEOIssue[] {
  const issues: SEOIssue[] = [];

  if (sitemapSet.size === 0) {
    issues.push({
      type: 'missing_sitemap',
      severity: 'warning',
      url: '/',
      message: 'No sitemap.xml was found for this domain.',
      recommendation: 'Create a sitemap.xml and submit it to Google Search Console.',
    });
    return issues;
  }

  // Pages in crawl but not in sitemap (only flag indexable 200-status pages)
  for (const page of pages) {
    if (
      page.statusCode === 200 &&
      !page.robotsDirectives.some((d) => d.includes('noindex')) &&
      !sitemapSet.has(normalizeUrl(page.url))
    ) {
      issues.push({
        type: 'missing_sitemap',
        severity: 'warning',
        url: page.url,
        message: 'Page was crawled but is not listed in the sitemap.',
        recommendation: 'Add this URL to the sitemap.xml to ensure it is indexed.',
      });
    }
  }

  // Pages in sitemap returning non-200
  const crawledByUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p]));
  for (const sitemapUrl of sitemapSet) {
    const page = crawledByUrl.get(sitemapUrl);
    if (page && page.statusCode !== 200) {
      issues.push({
        type: 'broken_internal_link',
        severity: 'critical',
        url: page.url,
        message: `Sitemap URL returns ${page.statusCode} status code.`,
        recommendation: 'Remove this URL from the sitemap or fix the page.',
      });
    }
  }

  return issues;
}

function checkBrokenInternalLinks(pages: CrawledPage[]): SEOIssue[] {
  const issues: SEOIssue[] = [];
  const statusByUrl = new Map(pages.map((p) => [normalizeUrl(p.url), p.statusCode]));

  for (const page of pages) {
    for (const link of page.internalLinks) {
      const status = statusByUrl.get(normalizeUrl(link));
      if (status !== undefined && status >= 400) {
        issues.push({
          type: 'broken_internal_link',
          severity: 'critical',
          url: page.url,
          message: `Internal link to ${link} returns ${status}.`,
          recommendation: 'Fix or remove the broken internal link.',
        });
      }
    }
  }

  return issues;
}

// ─── Index builders ───────────────────────────────────────────────────────────

function buildTitleIndex(pages: CrawledPage[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.title) continue;
    const existing = index.get(page.title) ?? [];
    index.set(page.title, [...existing, page.url]);
  }
  return index;
}

function buildDescriptionIndex(pages: CrawledPage[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const page of pages) {
    if (!page.metaDescription) continue;
    const existing = index.get(page.metaDescription) ?? [];
    index.set(page.metaDescription, [...existing, page.url]);
  }
  return index;
}

function buildCanonicalIndex(pages: CrawledPage[]): Map<string, string> {
  // Maps normalized page URL → its canonical URL
  const index = new Map<string, string>();
  for (const page of pages) {
    if (page.canonicalUrl) {
      index.set(normalizeUrl(page.url), page.canonicalUrl);
    }
  }
  return index;
}

function buildInboundLinksIndex(pages: CrawledPage[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  for (const page of pages) {
    for (const link of page.internalLinks) {
      const key = normalizeUrl(link);
      const existing = index.get(key) ?? [];
      index.set(key, [...existing, page.url]);
    }
  }
  return index;
}

// ─── Scoring helpers ──────────────────────────────────────────────────────────

function computePageScores(
  pages: CrawledPage[],
  issues: SEOIssue[]
): Record<string, number> {
  const deductionsByUrl = new Map<string, number>();

  for (const issue of issues) {
    const deduction = issue.severity === 'critical' ? 12
      : issue.severity === 'warning' ? 4
      : 1;
    deductionsByUrl.set(
      issue.url,
      (deductionsByUrl.get(issue.url) ?? 0) + deduction
    );
  }

  return Object.fromEntries(
    pages.map((p) => [
      p.url,
      Math.max(0, 100 - (deductionsByUrl.get(p.url) ?? 0)),
    ])
  );
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function deduplicateIssues(issues: SEOIssue[]): SEOIssue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = `${issue.type}::${issue.url}::${issue.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sortIssues(issues: SEOIssue[]): SEOIssue[] {
  const order: Record<string, number> = { critical: 0, warning: 1, info: 2 };
  return [...issues].sort(
    (a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9)
  );
}

function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    u.hash = '';
    return `${u.protocol}//${u.hostname}${u.pathname.replace(/\/$/, '') || '/'}${u.search}`.toLowerCase();
  } catch {
    return url.toLowerCase();
  }
}
