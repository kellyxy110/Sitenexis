import type { AuditStatus } from '@sitenexis/shared';

export interface AuditScorecard {
  auditId: string;
  domain: string;
  status: AuditStatus;
  v1: {
    overall: number;
    seoScore: number;
    aiScore: number;
    schemaScore: number;
    linkGraphScore: number;
    performanceScore: number;
  } | null;
  v2: {
    aiVisibilityScore: number;
    machineReadabilityScore: number;
    entityConfidenceScore: number;
    retrievalReadinessScore: number;
    citationProbabilityScore: number;
    semanticTrustScore: number;
    recommendationConfidence: number;
  } | null;
  machineTrust: {
    overall: number;
    entityCredibilityScore: number;
    schemaTrustAlignmentScore: number;
    externalValidationScore: number;
    contradictionAbsenceScore: number | null;
  } | null;
  sii: { score: number; confidence: number } | null;
  /** Derived from which score tables actually exist for this audit — never a fabricated version string. */
  scoringModelLabel: string;
}

/**
 * Pure read of canonical, already-computed scores. No score is calculated
 * here — every field is a passthrough of what the scoring engines already
 * wrote to `audit_scores` / `ai_visibility_scores` / `machine_trust_scores` /
 * `sii_scores`. Used by Telegram's /audit (summary) and /scores (full)
 * commands.
 */
export async function getAuditScorecard(auditId: string): Promise<AuditScorecard | null> {
  const { getAuditById, getAuditScores, getAIVisibilityScore, getMachineTrustScore, getSIIScore } = await import('@sitenexis/db');

  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const [v1, v2, trust, sii] = await Promise.all([
    getAuditScores(auditId),
    getAIVisibilityScore(auditId),
    getMachineTrustScore(auditId).catch(() => null),
    getSIIScore(auditId).catch(() => null),
  ]);

  const labelParts: string[] = [];
  if (v1) labelParts.push('V1 Technical SEO');
  if (v2) labelParts.push('V2 AI Visibility');
  if (trust) labelParts.push('Layer 4 Machine Trust');
  if (sii) labelParts.push('SII composite');

  return {
    auditId,
    domain: audit.domain,
    status: audit.status,
    v1: v1 ? {
      overall: v1.overall,
      seoScore: v1.seoScore,
      aiScore: v1.aiScore,
      schemaScore: v1.schemaScore,
      linkGraphScore: v1.linkGraphScore,
      performanceScore: v1.performanceScore,
    } : null,
    v2: v2 ? {
      aiVisibilityScore: v2.aiVisibilityScore,
      machineReadabilityScore: v2.machineReadabilityScore,
      entityConfidenceScore: v2.entityConfidenceScore,
      retrievalReadinessScore: v2.retrievalReadinessScore,
      citationProbabilityScore: v2.citationProbabilityScore,
      semanticTrustScore: v2.semanticTrustScore,
      recommendationConfidence: v2.recommendationConfidence,
    } : null,
    machineTrust: trust ? {
      overall: trust.overall,
      entityCredibilityScore: trust.entityCredibilityScore,
      schemaTrustAlignmentScore: trust.schemaTrustAlignmentScore,
      externalValidationScore: trust.externalValidationScore,
      contradictionAbsenceScore: trust.contradictionAbsenceScore,
    } : null,
    sii: sii ? { score: sii.sii_score, confidence: sii.confidence } : null,
    scoringModelLabel: labelParts.length > 0 ? labelParts.join(' + ') : 'No canonical scores recorded yet',
  };
}
