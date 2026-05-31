import type { CrawledPage, TemporalIssue } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────���───────────────────────

export interface FreshnessResult {
  contentFreshnessImpactFactor: number;
  updateFrequencyClassification: 'active' | 'periodic' | 'stale' | 'abandoned';
  stalePagesAtRisk: string[];
  issues: TemporalIssue[];
}

// Milliseconds per day
const MS_PER_DAY = 86_400_000;

// Time-sensitive claim patterns — these decay faster in AI trust models
const TIME_SENSITIVE_PATTERNS = [
  /\b\d{4}\b/,
  /\b\d+(\.\d+)?%\b/,
  /\bversion\s+\d+/i,
  /\$[\d,]+/,
  /\b(latest|current|now|today|this year|recently)\b/i,
];

// ─── Content freshness impact scoring ───────────���────────────────────────────

/**
 * Scores the overall content freshness impact.
 * Time-sensitive claims on stale pages receive a freshness penalty.
 * Content-type aware: product pages decay faster than evergreen guides.
 */
export function analyseFreshness(pages: CrawledPage[]): FreshnessResult {
  const issues: TemporalIssue[] = [];
  const stalePagesAtRisk: string[] = [];
  const now = Date.now();

  const pageAges = pages.map((p) => ({
    page: p,
    ageDays: computeAgeDays(p, now),
    isTimeSensitive: isTimeSensitiveContent(p),
    contentType: classifyContentType(p),
  }));

  // Identify stale pages with time-sensitive content
  for (const { page, ageDays, isTimeSensitive, contentType } of pageAges) {
    const staleThreshold = getStaleThreshold(contentType);
    if (ageDays > staleThreshold && isTimeSensitive) {
      stalePagesAtRisk.push(page.url);
      issues.push({
        type: 'stale_time_sensitive_content',
        severity: ageDays > staleThreshold * 2 ? 'critical' : 'warning',
        pageUrl: page.url,
        description: `${contentType} page has time-sensitive claims but has not been updated in ~${Math.round(ageDays)} days (threshold: ${staleThreshold}d).`,
        recommendation: 'Update time-sensitive claims or add a content review date to prevent AI trust decay.',
      });
    }
  }

  // Update frequency classification based on median update frequency
  const updateFrequencyClassification = classifyUpdateFrequency(pageAges.map((p) => p.ageDays));

  // Freshness impact factor: ratio of fresh pages (under stale threshold) to total
  const freshCount = pageAges.filter(({ ageDays, contentType }) =>
    ageDays <= getStaleThreshold(contentType),
  ).length;

  const contentFreshnessImpactFactor = pages.length === 0
    ? 1.0
    : Math.round((freshCount / pages.length) * 100) / 100;

  if (updateFrequencyClassification === 'stale' || updateFrequencyClassification === 'abandoned') {
    issues.push({
      type: 'low_update_frequency',
      severity: updateFrequencyClassification === 'abandoned' ? 'critical' : 'warning',
      pageUrl: null as unknown as string,
      description: `Site content is classified as "${updateFrequencyClassification}" — AI systems apply accelerated trust decay to infrequently updated content.`,
      recommendation: 'Establish a regular content review and update schedule. Prioritise pages with time-sensitive claims.',
    });
  }

  return {
    contentFreshnessImpactFactor,
    updateFrequencyClassification,
    stalePagesAtRisk,
    issues,
  };
}

// ─── Helpers ──��─────────────────────────────────────��─────────────────────────

function computeAgeDays(page: CrawledPage, now: number): number {
  // Try to extract date from schema markup
  for (const markup of page.schemaMarkup ?? []) {
    if (!markup || typeof markup !== 'object') continue;
    const obj = markup as Record<string, unknown>;
    const dateStr = obj['dateModified'] ?? obj['datePublished'];
    if (typeof dateStr === 'string') {
      try {
        const date = new Date(dateStr);
        if (!isNaN(date.getTime())) {
          return (now - date.getTime()) / MS_PER_DAY;
        }
      } catch {
        // ignore
      }
    }
  }

  // Fallback: use crawledAt if available
  if (page.crawledAt) {
    return (now - new Date(page.crawledAt).getTime()) / MS_PER_DAY;
  }

  // Unknown age — assume moderately stale (90 days)
  return 90;
}

function isTimeSensitiveContent(page: CrawledPage): boolean {
  const text = page.bodyText ?? '';
  return TIME_SENSITIVE_PATTERNS.some((p) => p.test(text));
}

type ContentType = 'product' | 'article' | 'evergreen' | 'unknown';

function classifyContentType(page: CrawledPage): ContentType {
  const url = page.url.toLowerCase();
  const text = (page.bodyText ?? '').toLowerCase();

  if (/\/(product|shop|store|buy|cart)/.test(url) || /\b(price|buy now|add to cart)\b/.test(text)) {
    return 'product';
  }
  if (/\/(blog|news|article|post)/.test(url) || page.schemaMarkup?.some((m: unknown) => {
    if (!m || typeof m !== 'object') return false;
    const t = (m as Record<string, unknown>)['@type'];
    return t === 'Article' || t === 'BlogPosting' || t === 'NewsArticle';
  })) {
    return 'article';
  }
  if (/\/(guide|how-to|tutorial|faq|about|services?)/.test(url)) {
    return 'evergreen';
  }
  return 'unknown';
}

function getStaleThreshold(contentType: ContentType): number {
  switch (contentType) {
    case 'product': return 90;    // 3 months
    case 'article': return 180;   // 6 months
    case 'evergreen': return 365; // 1 year
    default: return 180;          // 6 months default
  }
}

function classifyUpdateFrequency(ageDaysArray: number[]): FreshnessResult['updateFrequencyClassification'] {
  if (ageDaysArray.length === 0) return 'unknown' as never;

  const median = ageDaysArray.sort((a, b) => a - b)[Math.floor(ageDaysArray.length / 2)];

  if (median <= 7) return 'active';
  if (median <= 30) return 'periodic';
  if (median <= 180) return 'stale';
  return 'abandoned';
}
