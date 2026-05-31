import type {
  CrawledPage,
  EntityIntelligenceReport,
  CitationAnalysis,
  TemporalAuthorityResult,
} from '@sitenexis/shared';
import { analyseFreshness } from './freshness';
import { analyseSemanticDrift } from './drift';
import { computeAuthorityVelocity, updateFrequencyToScore } from './history';

export { analyseFreshness } from './freshness';
export { analyseSemanticDrift } from './drift';
export { computeAuthorityVelocity, updateFrequencyToScore } from './history';

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
  };
}
