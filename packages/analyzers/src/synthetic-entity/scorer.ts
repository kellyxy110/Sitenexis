import type { SyntheticPattern, FlaggedEntity, SyntheticEntityAnalysis } from '@sitenexis/shared';
import type { NetworkIntegrityResult } from './network';

/**
 * Aggregates all detected synthetic patterns into a final risk score.
 *
 * Risk Score formula (CLAUDE.md §26):
 *   Fake Entity Pattern Score          × 0.25
 *   + AI Authority Network Score       × 0.25
 *   + Schema Manipulation Score        × 0.20
 *   + Citation Farming Score           × 0.15
 *   + Unnatural Clustering Score       × 0.15
 *
 * Score is inverted for user presentation:
 *   Entity Authenticity Confidence = 100 - Synthetic Entity Risk Score
 *
 * All findings are labelled with detection confidence — never binary flags.
 */
export function aggregateSyntheticRisk(
  allPatterns: SyntheticPattern[],
  networkResult: NetworkIntegrityResult,
): SyntheticEntityAnalysis {
  const byType = new Map<SyntheticPattern['patternType'], SyntheticPattern[]>();
  for (const pattern of allPatterns) {
    const existing = byType.get(pattern.patternType) ?? [];
    byType.set(pattern.patternType, [...existing, pattern]);
  }

  const fakeEntityScore = averageConfidence(byType.get('fake_entity') ?? []) * 100;
  const authorityNetworkScore = averageConfidence(byType.get('authority_network') ?? []) * 100;
  const schemaManipulationScore = averageConfidence(byType.get('schema_manipulation') ?? []) * 100;
  const citationFarmingScore = averageConfidence(byType.get('citation_farming') ?? []) * 100;
  const unnaturalClusteringScore = averageConfidence(byType.get('unnatural_clustering') ?? []) * 100;

  const syntheticRiskScore = Math.round(
    fakeEntityScore * 0.25
    + authorityNetworkScore * 0.25
    + schemaManipulationScore * 0.20
    + citationFarmingScore * 0.15
    + unnaturalClusteringScore * 0.15,
  );

  const entityAuthenticityConfidence = Math.max(0, 100 - syntheticRiskScore);

  // Compile flagged entities from all patterns
  const flaggedEntityMap = new Map<string, FlaggedEntity>();
  for (const pattern of allPatterns) {
    if (pattern.confidence < 0.3) continue;
    for (const entityName of pattern.affectedEntities) {
      if (!flaggedEntityMap.has(entityName)) {
        flaggedEntityMap.set(entityName, {
          entityName,
          flagReason: `${pattern.patternType} pattern detected`,
          confidence: pattern.confidence,
        });
      }
    }
  }

  // Recommendations based on highest-confidence patterns
  const recommendations = buildRecommendations(allPatterns, syntheticRiskScore);

  return {
    syntheticRiskScore: Math.min(100, syntheticRiskScore),
    entityAuthenticityConfidence: Math.min(100, entityAuthenticityConfidence),
    networkIntegrityScore: networkResult.networkIntegrityScore,
    detectedPatterns: allPatterns.filter((p) => p.confidence > 0),
    flaggedEntities: [...flaggedEntityMap.values()],
    recommendations,
  };
}

function averageConfidence(patterns: SyntheticPattern[]): number {
  if (patterns.length === 0) return 0;
  return patterns.reduce((sum, p) => sum + p.confidence, 0) / patterns.length;
}

function buildRecommendations(patterns: SyntheticPattern[], riskScore: number): string[] {
  const recs: string[] = [];

  if (riskScore < 20) {
    recs.push('No significant synthetic patterns detected. Continue maintaining organic entity signals.');
    return recs;
  }

  const typeSet = new Set(patterns.filter((p) => p.confidence > 0.3).map((p) => p.patternType));

  if (typeSet.has('fake_entity')) {
    recs.push('Add external sameAs links to authoritative sources (Wikipedia, Wikidata, LinkedIn) for all primary entities.');
    recs.push('Ensure all entities mentioned in schema markup are also discussed in body text.');
  }
  if (typeSet.has('authority_network')) {
    recs.push('Review sameAs link distribution — ensure links point to independent, authoritative external sources rather than clustered profiles.');
  }
  if (typeSet.has('schema_manipulation')) {
    recs.push('Audit all schema markup for accuracy — remove schema claims not evidenced in body text.');
  }
  if (typeSet.has('citation_farming')) {
    recs.push('Add external links to authoritative sources when making factual claims. Self-referential citation networks reduce AI trust signals.');
  }
  if (typeSet.has('unnatural_clustering')) {
    recs.push('Review entity graph density — ensure entity relationships reflect genuine topical connections.');
  }

  return recs;
}
