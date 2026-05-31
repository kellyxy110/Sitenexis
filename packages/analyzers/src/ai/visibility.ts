import type {
  MachineReadabilityScore,
  EntityIntelligenceReport,
  AIReadabilityScore,
  CitationAnalysis,
  SemanticTrustScore,
  SchemaScore,
} from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AIVisibilityScore {
  score: number;
  breakdown: {
    machineReadability: number;
    entityConfidence: number;
    retrievalReadiness: number;
    citationProbability: number;
    semanticTrust: number;
    schemaCompleteness: number;
  };
  recommendationConfidenceScore: number;
}

// ─── AI Visibility Score ──────────────────────────────────────────────────────

/**
 * Computes the AI Visibility Score from Layer 2+3 sub-scores.
 *
 * Formula (CLAUDE.md §19):
 *   Machine Readability    × 0.15
 *   Entity Confidence      × 0.20
 *   Retrieval Readiness    × 0.20
 *   Citation Probability   × 0.20
 *   Semantic Trust         × 0.15
 *   Schema Completeness    × 0.10
 *
 * Total weight = 1.00. Remaining 0.00 is reserved for future provider signals.
 */
export function calculateAIVisibilityScore(inputs: {
  machineReadability: MachineReadabilityScore;
  entityIntelligence: EntityIntelligenceReport;
  aiReadability: AIReadabilityScore;
  citationAnalysis: CitationAnalysis;
  semanticTrust: SemanticTrustScore;
  schema: SchemaScore;
}): AIVisibilityScore {
  const machineReadability = inputs.machineReadability.score;
  const entityConfidence = inputs.entityIntelligence.entityConfidenceScore;
  const retrievalReadiness = inputs.aiReadability.score;
  const citationProbability = inputs.citationAnalysis.citationProbabilityScore;
  const semanticTrust = inputs.semanticTrust.score;
  const schemaCompleteness = inputs.schema.score;

  const score = Math.round(
    machineReadability * 0.15
    + entityConfidence * 0.20
    + retrievalReadiness * 0.20
    + citationProbability * 0.20
    + semanticTrust * 0.15
    + schemaCompleteness * 0.10,
  );

  const recommendationConfidenceScore = calculateRecommendationConfidenceScore(inputs);

  return {
    score,
    breakdown: {
      machineReadability,
      entityConfidence,
      retrievalReadiness,
      citationProbability,
      semanticTrust,
      schemaCompleteness,
    },
    recommendationConfidenceScore,
  };
}

// ─── Recommendation Confidence Score ─────────────────────────────────────────

/**
 * Models the probability that an AI system recommends this site unprompted.
 *
 * Driven by (CLAUDE.md §31):
 *   Entity authority          × 0.30
 *   Citation signals          × 0.30
 *   Trust + credibility       × 0.20
 *   Machine extractability    × 0.10
 *   Structural signals        × 0.10
 */
export function calculateRecommendationConfidenceScore(inputs: {
  entityIntelligence: EntityIntelligenceReport;
  citationAnalysis: CitationAnalysis;
  semanticTrust: SemanticTrustScore;
  machineReadability: MachineReadabilityScore;
  schema: SchemaScore;
}): number {
  const entityAuthority = inputs.entityIntelligence.entityConfidenceScore;
  const citationSignals = inputs.citationAnalysis.citationProbabilityScore;
  const trust = inputs.semanticTrust.score;
  const extractability = inputs.machineReadability.score;
  const structural = inputs.schema.score;

  return Math.round(
    entityAuthority * 0.30
    + citationSignals * 0.30
    + trust * 0.20
    + extractability * 0.10
    + structural * 0.10,
  );
}

// ─── Common recommendation blockers ──────────────────────────────────────────

export function getRecommendationBlockers(inputs: {
  entityIntelligence: EntityIntelligenceReport;
  citationAnalysis: CitationAnalysis;
  semanticTrust: SemanticTrustScore;
  machineReadability: MachineReadabilityScore;
}): string[] {
  const blockers: string[] = [];

  if (!inputs.entityIntelligence.primaryEntity) {
    blockers.push('No primary entity defined — AI systems cannot anchor recommendations without a clear subject.');
  }
  if (inputs.entityIntelligence.entityConfidenceScore < 40) {
    blockers.push('Entity confidence is critically low — inconsistent or unverifiable entity signals.');
  }
  if (inputs.citationAnalysis.citationProbabilityScore < 40) {
    blockers.push('Citation probability too low — content lacks the factual density and specificity for AI citation.');
  }
  if (inputs.semanticTrust.score < 40) {
    blockers.push('Semantic trust score is critical — missing authorship, organisation, or content trust signals.');
  }
  if (inputs.machineReadability.score < 40) {
    blockers.push('Machine readability is critical — significant extraction loss before content reaches the model.');
  }

  return blockers;
}
