export interface GeoScoreInput {
  citationProbabilityScore: number;
  retrievalReadinessScore: number;
  semanticTrustScore: number;
  topicalAuthorityScore: number;
  machineReadabilityScore: number;
  entityConfidenceScore: number;
}

export interface GeoScoreResult {
  score: number;
  breakdown: {
    citationProbability: number;
    retrievalReadiness: number;
    semanticTrust: number;
    topicalAuthority: number;
    machineReadability: number;
    entityConfidence: number;
  };
}

export function computeGeoScore(input: GeoScoreInput): GeoScoreResult {
  // GEO = CP×0.25 + RR×0.20 + ST×0.20 + TA×0.15 + MR×0.10 + EC×0.10
  const score = Math.round(
    input.citationProbabilityScore * 0.25 +
    input.retrievalReadinessScore * 0.20 +
    input.semanticTrustScore * 0.20 +
    input.topicalAuthorityScore * 0.15 +
    input.machineReadabilityScore * 0.10 +
    input.entityConfidenceScore * 0.10,
  );

  return {
    score,
    breakdown: {
      citationProbability: input.citationProbabilityScore,
      retrievalReadiness: input.retrievalReadinessScore,
      semanticTrust: input.semanticTrustScore,
      topicalAuthority: input.topicalAuthorityScore,
      machineReadability: input.machineReadabilityScore,
      entityConfidence: input.entityConfidenceScore,
    },
  };
}
