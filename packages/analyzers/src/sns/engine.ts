export interface SnsScoreInput {
  aiVisibilityScore: number;
  geoScore: number;
  retrievalReadinessScore: number;
  entityConfidenceScore: number;
  citationProbabilityScore: number;
  semanticTrustScore: number;
  topicalAuthorityScore: number;
  knowledgeGraphScore: number;   // KGS — perception graph strength
  aiCrawlabilityScore: number;   // ARC — ACI score
  authorityMatchScore: number;   // AMS — schema completeness
}

export type SnsLabel = 'Dominant' | 'Strong' | 'Developing' | 'Weak';

export interface SnsScoreResult {
  score: number;
  label: SnsLabel;
  breakdown: {
    aiVisibility: number;
    geo: number;
    retrievalReadiness: number;
    entityConfidence: number;
    citationProbability: number;
    semanticTrust: number;
    topicalAuthority: number;
    knowledgeGraph: number;
    aiCrawlability: number;
    authorityMatch: number;
  };
}

function getSnsLabel(score: number): SnsLabel {
  if (score >= 80) return 'Dominant';
  if (score >= 60) return 'Strong';
  if (score >= 40) return 'Developing';
  return 'Weak';
}

export function computeSnsScore(input: SnsScoreInput): SnsScoreResult {
  // SNS = AVS×0.15 + GEO×0.15 + RR×0.10 + EC×0.10 + CP×0.10 + ST×0.10
  //       + TA×0.10 + KGS×0.05 + ARC×0.05 + AMS×0.10
  const score = Math.round(
    input.aiVisibilityScore * 0.15 +
    input.geoScore * 0.15 +
    input.retrievalReadinessScore * 0.10 +
    input.entityConfidenceScore * 0.10 +
    input.citationProbabilityScore * 0.10 +
    input.semanticTrustScore * 0.10 +
    input.topicalAuthorityScore * 0.10 +
    input.knowledgeGraphScore * 0.05 +
    input.aiCrawlabilityScore * 0.05 +
    input.authorityMatchScore * 0.10,
  );

  return {
    score,
    label: getSnsLabel(score),
    breakdown: {
      aiVisibility: input.aiVisibilityScore,
      geo: input.geoScore,
      retrievalReadiness: input.retrievalReadinessScore,
      entityConfidence: input.entityConfidenceScore,
      citationProbability: input.citationProbabilityScore,
      semanticTrust: input.semanticTrustScore,
      topicalAuthority: input.topicalAuthorityScore,
      knowledgeGraph: input.knowledgeGraphScore,
      aiCrawlability: input.aiCrawlabilityScore,
      authorityMatch: input.authorityMatchScore,
    },
  };
}
