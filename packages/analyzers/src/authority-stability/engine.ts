/**
 * Authority Stability Engine
 *
 * Evaluates how resistant a website is to Google Core Updates and AI ranking
 * shifts. Models three key signals that distinguish first-party authorities
 * from aggregators, and predicts Core Update survival probability.
 *
 * Does NOT modify semantic trust scoring. Takes existing SemanticTrustScore
 * and EntityIntelligenceReport as inputs and builds a separate composite.
 */

import type {
  CrawledPage,
  AuthorityStabilityScore,
  AggregationRisk,
  SiteClassification,
  SemanticTrustScore,
  EntityIntelligenceReport,
} from '@sitenexis/shared';

// ─── First-party content depth ────────────────────────────────────────────────

function scoreFirstPartyDepth(pages: CrawledPage[]): number {
  if (pages.length === 0) return 0;
  let score = 50; // baseline

  // Original research / data signals
  const dataPages = pages.filter((p) => {
    const text = (p.bodyText ?? '').toLowerCase();
    return (
      text.includes('our research') ||
      text.includes('we found') ||
      text.includes('our data') ||
      text.includes('our study') ||
      text.includes('we measured') ||
      text.includes('in our testing') ||
      text.includes('survey') ||
      /\d+%\s+of\s+respondents?/.test(text)
    );
  });
  score += Math.min(25, (dataPages.length / pages.length) * 100);

  // Proprietary statistics / benchmarks
  const statPages = pages.filter((p) => {
    const text = p.bodyText ?? '';
    return (/\d+,\d{3}/.test(text) || /\d+\.\d+%/.test(text)) && text.length > 800;
  });
  score += Math.min(15, (statPages.length / pages.length) * 60);

  // Author attribution (first-party expertise signal)
  const authoredPages = pages.filter(
    (p) => (p.schemaMarkup).some(
      (s) => (s as { type?: string }).type === 'Article' || (s as { type?: string }).type === 'BlogPosting',
    ),
  );
  if (authoredPages.length > 0) score += 10;

  return Math.min(100, Math.round(score));
}

// ─── Content originality ──────────────────────────────────────────────────────

function scoreContentOriginality(pages: CrawledPage[]): number {
  if (pages.length === 0) return 0;
  let score = 60; // baseline

  // Aggregation patterns: heavy external link density + thin body text
  const aggregatorPages = pages.filter((p) => {
    const extLinks = (p.externalLinks ?? []).length;
    const wordCount = (p.bodyText ?? '').split(/\s+/).length;
    // More external links than internal + thin content = aggregation pattern
    return extLinks > (p.internalLinks ?? []).length && wordCount < 400;
  });
  const aggregatorRatio = aggregatorPages.length / pages.length;
  score -= Math.round(aggregatorRatio * 40);

  // Long-form original content (> 800 words with few external links)
  const originalPages = pages.filter((p) => {
    const wordCount = (p.bodyText ?? '').split(/\s+/).length;
    const extLinks = (p.externalLinks ?? []).length;
    return wordCount > 800 && extLinks < 10;
  });
  score += Math.min(30, (originalPages.length / pages.length) * 60);

  // Unique angles: how-to, case study, tutorial, guide patterns
  const uniqueContentPages = pages.filter((p) => {
    const title = (p.title ?? '').toLowerCase();
    return (
      title.includes('how to') ||
      title.includes('guide') ||
      title.includes('tutorial') ||
      title.includes('case study') ||
      title.includes('review') ||
      title.includes('analysis')
    );
  });
  if (uniqueContentPages.length > pages.length * 0.2) score += 10;

  return Math.min(100, Math.max(0, Math.round(score)));
}

// ─── Expert attribution ────────────────────────────────────────────────────────

function scoreExpertAttribution(
  pages: CrawledPage[],
  semanticTrust: SemanticTrustScore,
): number {
  // Base on existing authorship trust sub-score (avoids duplicating logic)
  let score = semanticTrust.breakdown.authorshipTrust;

  // Bonus for organisation schema with industry classification
  const orgSchema = pages.some((p) =>
    (p.schemaMarkup).some((s) => {
      const schema = s as Record<string, unknown>;
      return schema['@type'] === 'Organization' || schema['@type'] === 'LocalBusiness';
    }),
  );
  if (orgSchema) score = Math.min(100, score + 10);

  // Bonus for Person schema with credentials
  const personSchema = pages.some((p) =>
    (p.schemaMarkup).some((s) => (s as Record<string, unknown>)['@type'] === 'Person'),
  );
  if (personSchema) score = Math.min(100, score + 10);

  return Math.round(score);
}

// ─── Aggregation risk classification ─────────────────────────────────────────

function classifyAggregationRisk(
  firstPartyScore: number,
  originalityScore: number,
  pages: CrawledPage[],
): AggregationRisk {
  const avgScore = (firstPartyScore + originalityScore) / 2;
  const totalWords = pages.reduce(
    (sum, p) => sum + (p.bodyText ?? '').split(/\s+/).length, 0,
  );
  const avgWordCount = pages.length > 0 ? totalWords / pages.length : 0;

  if (avgScore < 35 || avgWordCount < 300) return 'high';
  if (avgScore < 55 || avgWordCount < 500) return 'medium';
  return 'low';
}

function classifySiteType(
  firstPartyScore: number,
  aggregationRisk: AggregationRisk,
): SiteClassification {
  if (aggregationRisk === 'high' && firstPartyScore < 40) return 'aggregator';
  if (aggregationRisk === 'low'  && firstPartyScore > 65) return 'first_party_authority';
  return 'hybrid';
}

// ─── Core Update survival probability ────────────────────────────────────────

function computeCoreUpdateSurvival(
  authorityScore: number,
  firstPartyScore: number,
  entityReport: EntityIntelligenceReport,
  aggregationRisk: AggregationRisk,
): number {
  let probability = 50; // baseline 50%

  // First-party depth is the single most predictive signal
  probability += Math.round((firstPartyScore - 50) * 0.5);

  // Entity clarity is the second most predictive signal
  probability += Math.round((entityReport.entityConfidenceScore - 50) * 0.3);

  // Overall authority composite
  probability += Math.round((authorityScore - 50) * 0.2);

  // Aggregation risk penalty
  if (aggregationRisk === 'high')   probability -= 20;
  if (aggregationRisk === 'medium') probability -= 8;

  return Math.min(95, Math.max(5, probability));
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function analyzeAuthorityStability(
  pages: CrawledPage[],
  semanticTrust: SemanticTrustScore,
  entityReport: EntityIntelligenceReport,
): AuthorityStabilityScore {
  if (pages.length === 0) {
    return {
      score: 0,
      aggregationRisk: 'high',
      coreUpdateSurvivalProbability: 20,
      firstPartyDepthScore: 0,
      contentOriginalityScore: 0,
      expertAttributionScore: 0,
      classification: 'aggregator',
      weakSignals: ['No pages crawled — cannot assess authority signals'],
      strengtheningRecommendations: ['Ensure the crawler can access the site'],
    };
  }

  const firstPartyDepthScore    = scoreFirstPartyDepth(pages);
  const contentOriginalityScore = scoreContentOriginality(pages);
  const expertAttributionScore  = scoreExpertAttribution(pages, semanticTrust);
  const aggregationRisk         = classifyAggregationRisk(firstPartyDepthScore, contentOriginalityScore, pages);
  const classification          = classifySiteType(firstPartyDepthScore, aggregationRisk);

  // Authority Stability Score = weighted composite
  const score = Math.round(
    firstPartyDepthScore    * 0.35 +
    contentOriginalityScore * 0.30 +
    expertAttributionScore  * 0.20 +
    semanticTrust.breakdown.organisationalTrust * 0.15,
  );

  const coreUpdateSurvivalProbability = computeCoreUpdateSurvival(
    score, firstPartyDepthScore, entityReport, aggregationRisk,
  );

  // Weak signals
  const weakSignals: string[] = [];
  if (firstPartyDepthScore < 40)    weakSignals.push('No first-party research, data, or original analysis detected');
  if (contentOriginalityScore < 40) weakSignals.push('Content appears to aggregate external information rather than produce original insight');
  if (expertAttributionScore < 40)  weakSignals.push('Missing author attribution and organisational credential signals');
  if (aggregationRisk === 'high')   weakSignals.push('High aggregation risk — site pattern matches sites that historically lose visibility in Core Updates');

  // Recommendations
  const strengtheningRecommendations: string[] = [];
  if (firstPartyDepthScore < 60) {
    strengtheningRecommendations.push('Produce original research, surveys, or proprietary data that AI systems cannot retrieve from primary sources directly.');
  }
  if (contentOriginalityScore < 60) {
    strengtheningRecommendations.push('Shift content strategy from aggregation (curating others\' content) to synthesis (original expert analysis of primary sources).');
  }
  if (expertAttributionScore < 60) {
    strengtheningRecommendations.push('Add Person schema with named authors, credentials, and sameAs links to professional profiles on key editorial pages.');
  }
  if (aggregationRisk !== 'low') {
    strengtheningRecommendations.push('Build topical authority depth in a focused niche rather than broad surface coverage. AI systems reward depth over breadth.');
  }

  return {
    score: Math.min(100, Math.max(0, score)),
    aggregationRisk,
    coreUpdateSurvivalProbability,
    firstPartyDepthScore,
    contentOriginalityScore,
    expertAttributionScore,
    classification,
    weakSignals,
    strengtheningRecommendations,
  };
}
