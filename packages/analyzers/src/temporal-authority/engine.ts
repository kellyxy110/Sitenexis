import type {
  CrawledPage,
  EntityIntelligenceReport,
  CitationAnalysis,
  TemporalAuthorityResult,
  UpdateFrequencyClassification,
  VisibilityRampPoint,
} from '@sitenexis/shared';
import { analyseFreshness } from './freshness';
import { analyseSemanticDrift } from './drift';
import { computeAuthorityVelocity, updateFrequencyToScore } from './history';

export { analyseFreshness } from './freshness';
export { analyseSemanticDrift } from './drift';
export { computeAuthorityVelocity, updateFrequencyToScore } from './history';

// ─── Intelligence Module: Freshness Velocity Score + Visibility Ramp ─────────

/**
 * Estimates days to reach full AI retrieval awareness after publication.
 * Shorter = better — active sites with AI crawlers allowed reach awareness faster.
 */
function estimateVisibilityRampDays(
  freq: UpdateFrequencyClassification,
  freshnessImpact: number,
): number {
  const base: Record<UpdateFrequencyClassification, number> = {
    active:   4,
    periodic: 9,
    stale:    16,
    abandoned: 25,
  };
  // Adjust for freshness impact: high freshness (close to 1) = shorter ramp
  const freshnessBonus = Math.round((1 - freshnessImpact) * 4);
  return Math.min(28, Math.max(2, (base[freq] ?? 9) + freshnessBonus));
}

/**
 * Builds a 0–14 day visibility ramp curve.
 * Each point models the estimated cumulative AI visibility (0–100) at that day.
 */
function buildRampCurve(
  rampDays: number,
  velocityScore: number | null,
): VisibilityRampPoint[] {
  const maxVis = velocityScore !== null ? Math.min(95, 30 + velocityScore * 0.65) : 60;
  const curve: VisibilityRampPoint[] = [];

  for (let day = 0; day <= 14; day++) {
    // Sigmoid-like ramp: slow start, fast middle, plateau
    const progress = day / rampDays;
    const sigmoid = 1 / (1 + Math.exp(-6 * (progress - 0.5)));
    curve.push({
      day,
      estimatedVisibility: Math.min(100, Math.round(sigmoid * maxVis)),
    });
  }
  return curve;
}

/**
 * Freshness Velocity Score: composite of freshness impact + update frequency + velocity.
 * 0–100. Measures how dynamically the site maintains AI temporal relevance.
 */
function computeFreshnessVelocityScore(
  freshnessImpact: number,
  freq: UpdateFrequencyClassification,
  velocityScore: number | null,
): number {
  const freqScore: Record<UpdateFrequencyClassification, number> = {
    active: 90, periodic: 60, stale: 30, abandoned: 5,
  };
  const velocityComponent = velocityScore !== null ? velocityScore : 50; // baseline on first audit
  return Math.round(
    (freshnessImpact * 100) * 0.40 +
    (freqScore[freq] ?? 50)   * 0.35 +
    velocityComponent          * 0.25,
  );
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Runs the full Temporal Authority analysis.
 *
 * Per CLAUDE.md §24:
 * - First audit returns baseline record with authorityVelocityScore: null
 * - Semantic drift analysis limited to top 50 pages by PageRank
 * - Trust decay model parameters applied from freshness analysis
 *
 * @param pages              - Current audit's crawled pages
 * @param entityReport       - Current audit's entity intelligence output
 * @param citationAnalysis   - Current audit's citation analysis output
 * @param priorAudit         - Prior audit data for velocity + drift calculation (optional)
 */
export function runTemporalAuthorityAnalysis(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
  citationAnalysis: CitationAnalysis,
  priorAudit?: {
    entityConfidenceScore: number;
    citationProbabilityScore: number;
    pageTexts: Map<string, string>;
  },
): TemporalAuthorityResult {
  // Freshness + update frequency analysis
  const freshness = analyseFreshness(pages);

  // Semantic drift (top 50 pages — limited for compute cost)
  const currentPageTexts = new Map(
    pages.slice(0, 50).map((p) => [p.url, p.bodyText ?? '']),
  );
  const drift = analyseSemanticDrift(currentPageTexts, priorAudit?.pageTexts);

  // Authority velocity
  const freqScore = updateFrequencyToScore(freshness.updateFrequencyClassification);
  const velocity = computeAuthorityVelocity(
    entityReport,
    citationAnalysis,
    priorAudit?.entityConfidenceScore ?? null,
    priorAudit?.citationProbabilityScore ?? null,
    freqScore,
  );

  // Aggregate all temporal issues
  const allIssues = [
    ...freshness.issues,
    ...drift.issues,
  ];

  // Intelligence module extensions
  const freshnessVelocityScore = computeFreshnessVelocityScore(
    freshness.contentFreshnessImpactFactor,
    freshness.updateFrequencyClassification,
    velocity.authorityVelocityScore,
  );
  const visibilityRampDays = estimateVisibilityRampDays(
    freshness.updateFrequencyClassification,
    freshness.contentFreshnessImpactFactor,
  );
  const rampCurve = buildRampCurve(visibilityRampDays, velocity.authorityVelocityScore);

  return {
    isBaseline: velocity.isBaseline,
    authorityVelocityScore: velocity.authorityVelocityScore,
    trustStabilityIndex: velocity.trustStabilityIndex,
    contentFreshnessImpactFactor: freshness.contentFreshnessImpactFactor,
    semanticDriftIndex: drift.semanticDriftIndex,
    updateFrequencyClassification: freshness.updateFrequencyClassification,
    stalePagesAtRisk: freshness.stalePagesAtRisk,
    driftedPages: drift.driftedPages,
    temporalIssues: allIssues,
    freshnessVelocityScore,
    visibilityRampDays,
    rampCurve,
  };
}
