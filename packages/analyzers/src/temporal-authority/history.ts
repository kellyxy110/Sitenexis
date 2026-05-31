import type { EntityIntelligenceReport, CitationAnalysis } from '@sitenexis/shared';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthorityVelocityResult {
  authorityVelocityScore: number | null;
  trustStabilityIndex: number;
  isBaseline: boolean;
  velocityDirection: 'growing' | 'stable' | 'declining' | null;
}

// ─── Authority velocity calculation ─────────────────────────────────────────

/**
 * Computes the authority velocity score from delta between current and prior audits.
 *
 * Formula (CLAUDE.md §24):
 *   ΔEntity Confidence     × 0.30
 *   + ΔCitation Probability × 0.30
 *   + ΔExternal Validation  × 0.20
 *   + Update Frequency Score × 0.20
 *
 * Returns null velocity (baseline) when no prior audit data is available.
 */
export function computeAuthorityVelocity(
  currentEntity: EntityIntelligenceReport,
  currentCitation: CitationAnalysis,
  priorEntityScore?: number | null,
  priorCitationScore?: number | null,
  updateFrequencyScore?: number,
): AuthorityVelocityResult {
  // First audit — establish baseline, no velocity calculable
  if (priorEntityScore == null || priorCitationScore == null) {
    return {
      authorityVelocityScore: null,
      trustStabilityIndex: 1.0,
      isBaseline: true,
      velocityDirection: null,
    };
  }

  const deltaEntity = currentEntity.entityConfidenceScore - priorEntityScore;
  const deltaCitation = currentCitation.citationProbabilityScore - priorCitationScore;

  // Normalise deltas to 0–100 (delta range -100 to +100 → 0–100 scale)
  const normDeltaEntity = Math.round(((deltaEntity + 100) / 2));
  const normDeltaCitation = Math.round(((deltaCitation + 100) / 2));

  // External validation delta approximation — use entity sameAs count as proxy
  const externalSignalScore = Math.min(100,
    currentEntity.entitiesDetected.reduce((sum, e) => sum + e.sameAsUrls.length, 0) * 15,
  );

  const freqScore = updateFrequencyScore ?? 50;

  const authorityVelocityScore = Math.round(
    normDeltaEntity * 0.30
    + normDeltaCitation * 0.30
    + externalSignalScore * 0.20
    + freqScore * 0.20,
  );

  const velocityDirection: AuthorityVelocityResult['velocityDirection'] =
    authorityVelocityScore >= 70 ? 'growing'
      : authorityVelocityScore >= 40 ? 'stable'
        : 'declining';

  // Trust stability index: how consistent the authority signals are over time
  const maxDelta = Math.max(Math.abs(deltaEntity), Math.abs(deltaCitation));
  const trustStabilityIndex = Math.round(Math.max(0, 1 - maxDelta / 100) * 100) / 100;

  return {
    authorityVelocityScore: Math.min(100, Math.max(0, authorityVelocityScore)),
    trustStabilityIndex,
    isBaseline: false,
    velocityDirection,
  };
}

// ─── Update frequency scoring ─────────────────────────────────────────────────

/**
 * Converts update frequency classification to a 0–100 score for use in
 * velocity computation.
 */
export function updateFrequencyToScore(
  classification: 'active' | 'periodic' | 'stale' | 'abandoned',
): number {
  switch (classification) {
    case 'active': return 100;
    case 'periodic': return 70;
    case 'stale': return 30;
    case 'abandoned': return 0;
  }
}
