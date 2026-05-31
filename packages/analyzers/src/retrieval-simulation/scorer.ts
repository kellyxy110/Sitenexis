import type { RetrievalSimulationResult } from '@sitenexis/shared';
import type { ChunkStabilityResult } from './chunker';
import type { RankingPressureResult } from './ranker';
import type { SummarisationResult } from './summarizer';

// ─── Citation eligibility scoring ────────────────────────────────────────────

/**
 * Models whether a retrieved chunk would pass an AI system's citation filter.
 * Factors: specificity, authority signal density, factual verifiability.
 */
function scoreCitationEligibility(
  stability: ChunkStabilityResult,
  ranking: RankingPressureResult,
  summarisation: SummarisationResult,
): number {
  let score = 0;

  // Self-contained chunks are citable without external context
  const selfContainedRatio = stability.chunks.length > 0
    ? stability.chunks.filter((c) => c.isSelfContained).length / stability.chunks.length
    : 0;
  score += selfContainedRatio * 35;

  // High ranking pressure correlates with citation-worthy content
  score += (ranking.embeddingSimilarityEstimate / 100) * 35;

  // Low summarisation loss means the claim survives citation extraction
  score += (summarisation.summarisationLossScore / 100) * 30;

  return Math.round(Math.min(100, score));
}

// ─── Answer formation probability ────────────────────────────────────────────

/**
 * Estimates the probability (0–100) that content from this page forms part of
 * an AI-generated answer for at least one of the modeled query types.
 *
 * Combines: retrieval rank × chunk stability × summarisation loss factor.
 */
function scoreAnswerFormationProbability(
  stability: ChunkStabilityResult,
  ranking: RankingPressureResult,
  summarisation: SummarisationResult,
): number {
  const rankFactor = ranking.embeddingSimilarityEstimate / 100;
  const stabilityFactor = stability.stabilityIndex;
  const summarisationFactor = summarisation.summarisationLossScore / 100;

  // Multiply all three — a weakness in any stage degrades the overall probability
  const probability = rankFactor * stabilityFactor * summarisationFactor * 100;

  return Math.round(Math.min(100, probability));
}

// ─── Retrieval Quality Score ──────────────────────────────────────────────────

/**
 * Computes the Retrieval Quality Score for a single page.
 *
 * Formula (CLAUDE.md §22):
 *   Chunk Stability Index          × 25
 *   + Answer Formation Probability × 25
 *   + Summarisation Loss Score     × 25
 *   + Citation Eligibility Score   × 25
 */
export function scoreRetrievalQuality(
  stability: ChunkStabilityResult,
  ranking: RankingPressureResult,
  summarisation: SummarisationResult,
): RetrievalSimulationResult {
  const chunkStabilityIndex = stability.stabilityIndex;
  const answerFormationProbability = scoreAnswerFormationProbability(stability, ranking, summarisation) / 100;
  const summarisationLossScore = summarisation.summarisationLossScore;
  const citationEligibilityScore = scoreCitationEligibility(stability, ranking, summarisation);

  const retrievalQualityScore = Math.round(
    chunkStabilityIndex * 25
    + answerFormationProbability * 25
    + (summarisationLossScore / 100) * 25
    + (citationEligibilityScore / 100) * 25,
  );

  // Build failure reasons from sub-scores
  const retrievalFailureReasons = buildFailureReasons(
    stability,
    ranking,
    summarisation,
    citationEligibilityScore,
  );

  return {
    pageUrl: stability.pageUrl,
    simulated: true,
    retrievalQualityScore,
    chunkStabilityIndex,
    answerFormationProbability,
    summarisationLossScore,
    citationEligibilityScore,
    retrievalFailureReasons,
    truncationZoneWarnings: summarisation.truncationZoneWarnings,
    fragileClaimsCount: summarisation.fragileClaimsCount,
  };
}

function buildFailureReasons(
  stability: ChunkStabilityResult,
  ranking: RankingPressureResult,
  summarisation: SummarisationResult,
  citationEligibilityScore: number,
): RetrievalSimulationResult['retrievalFailureReasons'] {
  const failures: RetrievalSimulationResult['retrievalFailureReasons'] = [];

  if (stability.stabilityIndex < 0.5) {
    failures.push({
      stage: 'chunk_extraction',
      description: `Chunk boundary instability index ${stability.stabilityIndex.toFixed(2)} — chunks split differently across retrieval strategies, causing inconsistent retrieval.`,
      severity: stability.stabilityIndex < 0.3 ? 'critical' : 'warning',
      affectedChunks: stability.unstableChunkIds.slice(0, 5),
      recommendation: 'Restructure content with cleaner paragraph breaks and self-contained semantic units.',
    });
  }

  if (ranking.outrankedByHighAuthority) {
    failures.push({
      stage: 'ranking_pressure',
      description: `Estimated embedding similarity ${ranking.embeddingSimilarityEstimate}/100 — likely outranked by higher-authority sources for most query types.`,
      severity: ranking.embeddingSimilarityEstimate < 35 ? 'critical' : 'warning',
      affectedChunks: [],
      recommendation: 'Increase topical depth and entity authority signals to improve retrieval ranking.',
    });
  }

  if (summarisation.summarisationLossScore < 60) {
    failures.push({
      stage: 'summarisation',
      description: `Summarisation loss score ${summarisation.summarisationLossScore}/100 — ${summarisation.fragileClaimsCount} fragile claims detected that are likely distorted under compression.`,
      severity: summarisation.summarisationLossScore < 40 ? 'critical' : 'warning',
      affectedChunks: [],
      recommendation: 'Replace cross-chunk dependencies with self-contained factual statements. Remove dangling pronoun references.',
    });
  }

  if (summarisation.truncationZoneWarnings.length > 0) {
    failures.push({
      stage: 'truncation',
      description: `${summarisation.truncationZoneWarnings.length} content section(s) positioned beyond the typical AI context window and at risk of being silently excluded.`,
      severity: summarisation.truncationZoneWarnings.length > 3 ? 'critical' : 'warning',
      affectedChunks: [],
      recommendation: 'Move critical facts and claims to the first half of the page.',
    });
  }

  if (citationEligibilityScore < 50) {
    failures.push({
      stage: 'citation_filter',
      description: `Citation eligibility score ${citationEligibilityScore}/100 — content does not meet the specificity and authority threshold for AI citation selection.`,
      severity: citationEligibilityScore < 30 ? 'critical' : 'warning',
      affectedChunks: [],
      recommendation: 'Add specific, verifiable factual claims with entity context to increase citation eligibility.',
    });
  }

  return failures;
}
