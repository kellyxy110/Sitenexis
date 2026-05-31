import type { CrawledPage, SurfaceScore, SurfaceBlocker } from '@sitenexis/shared';

/**
 * Models AI Overviews inclusion probability (CLAUDE.md §25 — Surface 1).
 *
 * Trigger conditions: Query must match a topic with sufficient structured signal.
 * Inclusion probability derived from:
 *   Retrieval Quality Score × 0.40
 *   + Schema Completeness   × 0.35
 *   + Citation Probability  × 0.25
 *
 * All scores are probabilistic estimates — not measured data.
 */
export function modelAIOverviewsInclusion(
  pages: CrawledPage[],
  retrievalQualityScore: number,
  schemaCompletenessScore: number,
  citationProbabilityScore: number,
): SurfaceScore {
  const blockers: SurfaceBlocker[] = [];

  // Check for featured-snippet-eligible content (direct answers, FAQ, concise factual claims)
  const hasFeaturedSnippetSignals = pages.some((p) => hasFeaturedSnippetEligibility(p));
  const hasFaqSchema = pages.some((p) => hasSchemaType(p, 'FAQPage'));
  const hasNoindexBlockers = pages.some((p) =>
    p.robotsDirectives.some((d) => d.toLowerCase().includes('noindex')),
  );

  let inclusionScore = Math.round(
    retrievalQualityScore * 0.40
    + schemaCompletenessScore * 0.35
    + citationProbabilityScore * 0.25,
  );

  if (!hasFeaturedSnippetSignals) {
    inclusionScore = Math.round(inclusionScore * 0.8);
    blockers.push({
      type: 'no_featured_snippet_eligibility',
      description: 'No direct-answer or FAQ content structure detected.',
      recommendation: 'Add concise factual answers and FAQ schema to key pages.',
    });
  }

  if (hasNoindexBlockers) {
    inclusionScore = Math.round(inclusionScore * 0.6);
    blockers.push({
      type: 'noindex_pages_present',
      description: 'Some pages have noindex directives, reducing overall site authority signals.',
      recommendation: 'Review noindex usage and ensure key pages are indexable.',
    });
  }

  if (hasFaqSchema) {
    inclusionScore = Math.min(100, Math.round(inclusionScore * 1.1));
  }

  const inclusionProbability = Math.min(100, Math.max(0, inclusionScore));

  return {
    inclusionProbability,
    status: classifySurfaceStatus(inclusionProbability),
    blockers,
    recommendations: blockers.map((b) => b.recommendation),
  };
}

function hasFeaturedSnippetEligibility(page: CrawledPage): boolean {
  const text = page.bodyText ?? '';
  return (
    /^(what|how|why|when|where|who)\b.*\?/im.test(text)
    || /^\d+\.\s/m.test(text)
    || text.length > 200 && text.length < 2000
  );
}

function hasSchemaType(page: CrawledPage, type: string): boolean {
  return (page.schemaMarkup ?? []).some((m) => {
    if (!m || typeof m !== 'object') return false;
    const t = (m as Record<string, unknown>)['@type'];
    return t === type || (Array.isArray(t) && t.includes(type));
  });
}

function classifySurfaceStatus(score: number): SurfaceScore['status'] {
  if (score >= 65) return 'visible';
  if (score >= 35) return 'partial';
  return 'absent';
}
