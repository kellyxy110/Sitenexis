import { type SEOIssue, type SEOScore } from '@sitenexis/shared';

/*
 * SEO Scoring Algorithm
 * ─────────────────────
 * Score starts at 100. Deductions are applied per issue type, normalised by
 * page count so a single bad page on a 500-page site has less impact than on
 * a 5-page site. The normalisation factor is capped at 10 pages to prevent
 * large sites from hiding systemic problems.
 *
 * Category budgets (sum = 100):
 *   Title optimisation      25 pts
 *   Meta optimisation       25 pts
 *   Heading structure       15 pts
 *   Canonicalisation        15 pts
 *   Crawlability            10 pts
 *   Image optimisation      10 pts
 *
 * Deduction weights (applied as raw points, then normalised):
 *   Critical issues:  -8 to -15 pts  (high-impact structural problems)
 *   Warning issues:   -2 to -5  pts  (fixable quality signals)
 *   Info issues:      -0.5 to -1 pt  (low-priority signals)
 *
 * Bonuses are additive (+3 to +5) and only applied when the site passes
 * the corresponding check across ALL pages, rewarding complete compliance.
 *
 * Final score is clamped to [0, 100] and rounded to the nearest integer.
 */

// ─── Deduction table ──────────────────────────────────────────────────────────
// Each issue type maps to its point deduction. Severity is validated for
// consistency but the type-specific value takes precedence.

const ISSUE_DEDUCTIONS: Record<string, number> = {
  // Critical (8–15)
  missing_title: 15,
  broken_canonical: 12,
  broken_internal_link: 12,
  // Warning (2–5)
  title_too_long: 3,
  title_too_short: 3,
  duplicate_title: 4,
  missing_meta_description: 4,
  duplicate_meta_description: 3,
  meta_description_too_long: 2,
  missing_h1: 8,
  multiple_h1: 4,
  missing_canonical: 3,
  redirect_chain: 3,
  noindex_page: 5,
  missing_sitemap: 4,
  missing_alt_text: 2,
  // Info (0.5–1)
  low_word_count: 1,
};

// Category membership — used to bucket deductions into breakdown sub-scores
const TITLE_TYPES = new Set([
  'missing_title', 'title_too_long', 'title_too_short', 'duplicate_title',
]);
const META_TYPES = new Set([
  'missing_meta_description', 'duplicate_meta_description', 'meta_description_too_long',
]);
const HEADING_TYPES = new Set(['missing_h1', 'multiple_h1']);
const CANONICAL_TYPES = new Set(['missing_canonical', 'broken_canonical']);
const CRAWLABILITY_TYPES = new Set([
  'noindex_page', 'redirect_chain', 'missing_robots_txt', 'missing_sitemap',
  'broken_internal_link',
]);
const IMAGE_TYPES = new Set(['missing_alt_text']);

// Category starting budgets — sum = 77; bonuses (max 23) bring a perfect site to 100.
const BUDGETS = {
  titleOptimisation: 20,
  metaOptimisation: 20,
  headingStructure: 12,
  canonicalisation: 12,
  crawlability: 8,
  imageOptimisation: 5,
} as const;

// ─── Bonus conditions ─────────────────────────────────────────────────────────

export interface SEOBonusContext {
  /** True if a valid sitemap was found during the crawl. */
  hasValidSitemap?: boolean;
}

function computeBonuses(issues: SEOIssue[], context: SEOBonusContext): number {
  let bonus = 0;

  const hasTitleIssues = issues.some((i) => TITLE_TYPES.has(i.type));
  if (!hasTitleIssues) bonus += 5; // all titles unique and within length

  const hasMetaIssues = issues.some((i) => META_TYPES.has(i.type));
  if (!hasMetaIssues) bonus += 5; // all pages have valid meta descriptions

  if (context.hasValidSitemap && !issues.some((i) => i.type === 'missing_sitemap')) {
    bonus += 5; // sitemap present and valid
  }

  const hasBrokenLinks = issues.some((i) => i.type === 'broken_internal_link');
  if (!hasBrokenLinks) bonus += 5; // no broken internal links

  const hasRedirects = issues.some((i) => i.type === 'redirect_chain');
  if (!hasRedirects) bonus += 3; // no redirect chains

  return bonus;
}

// ─── Main export ─────────────────────────────────────────────────────────────

/**
 * Calculate the SEO score from a set of issues.
 *
 * @param issues    - Deduplicated, sorted SEO issues from analyzeSEO().
 * @param pageCount - Total number of crawled pages (used for normalisation).
 * @param context   - Optional signals from the crawl context (sitemap presence etc).
 */
export function calculateSEOScore(
  issues: SEOIssue[],
  pageCount: number,
  context: SEOBonusContext = {}
): SEOScore {
  // Normalisation factor: each issue deducts proportionally less on large sites,
  // but large sites can't hide systemic issues entirely — cap at 10.
  const normFactor = Math.min(pageCount, 10);

  let titleOptimisation: number = BUDGETS.titleOptimisation;
  let metaOptimisation: number = BUDGETS.metaOptimisation;
  let headingStructure: number = BUDGETS.headingStructure;
  let canonicalisation: number = BUDGETS.canonicalisation;
  let crawlability: number = BUDGETS.crawlability;
  let imageOptimisation: number = BUDGETS.imageOptimisation;

  for (const issue of issues) {
    const rawDeduction = ISSUE_DEDUCTIONS[issue.type] ?? defaultDeduction(issue.severity);
    const deduction = rawDeduction / normFactor;

    // No per-category floor — excess deductions carry into the total, allowing
    // a site with many critical issues to score 0 even if other categories are clean.
    if (TITLE_TYPES.has(issue.type)) {
      titleOptimisation -= deduction;
    } else if (META_TYPES.has(issue.type)) {
      metaOptimisation -= deduction;
    } else if (HEADING_TYPES.has(issue.type)) {
      headingStructure -= deduction;
    } else if (CANONICAL_TYPES.has(issue.type)) {
      canonicalisation -= deduction;
    } else if (CRAWLABILITY_TYPES.has(issue.type)) {
      crawlability -= deduction;
    } else if (IMAGE_TYPES.has(issue.type)) {
      imageOptimisation -= deduction;
    }
  }

  const rawScore =
    titleOptimisation +
    metaOptimisation +
    headingStructure +
    canonicalisation +
    crawlability +
    imageOptimisation;

  const bonus = computeBonuses(issues, context);
  const finalScore = Math.round(Math.min(100, Math.max(0, rawScore + bonus)));

  return {
    score: finalScore,
    issues,
    breakdown: {
      titleOptimisation: Math.round(Math.max(0, titleOptimisation)),
      metaOptimisation: Math.round(Math.max(0, metaOptimisation)),
      headingStructure: Math.round(Math.max(0, headingStructure)),
      canonicalisation: Math.round(Math.max(0, canonicalisation)),
      crawlability: Math.round(Math.max(0, crawlability)),
      imageOptimisation: Math.round(Math.max(0, imageOptimisation)),
    },
  };
}

// ─── Label + colour helpers ───────────────────────────────────────────────────

/**
 * Returns a human-readable label for an SEO score.
 *
 * Thresholds match the global score label system defined in CLAUDE.md §19.
 */
export function getSEOScoreLabel(score: number): string {
  if (score >= 90) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 50) return 'Needs Work';
  return 'Critical Issues';
}

/**
 * Returns the hex colour token for an SEO score value.
 *
 * Uses the brand colour tokens defined in CLAUDE.md §35.
 */
export function getSEOScoreColor(score: number): string {
  if (score >= 90) return '#22C55E'; // green-500 — Excellent
  if (score >= 70) return '#0BCEBC'; // teal — Good
  if (score >= 50) return '#F59E0B'; // amber — Needs Work
  return '#EF4444';                  // red-500 — Critical
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

function defaultDeduction(severity: SEOIssue['severity']): number {
  switch (severity) {
    case 'critical': return 10;
    case 'warning': return 3;
    case 'info': return 0.5;
  }
}
