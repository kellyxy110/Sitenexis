import type { ConfidenceClass, ConfidenceScore, EvidenceFactors } from '@sitenexis/shared';

/**
 * Core confidence formula:
 *   confidence = evidenceCompleteness×0.4 + sourceReliability×0.3 + extractionConsistency×0.3
 *
 * Classification:
 *   0.90–1.00  VERIFIED   — treated as fact, reported at original severity
 *   0.70–0.89  PROBABLE   — reported with label, severity preserved
 *   0.50–0.69  WEAK       — critical downgraded to warning, warning downgraded to info
 *   < 0.50     SUPPRESSED — not surfaced to the user
 */
export function computeConfidence(factors: EvidenceFactors): ConfidenceScore {
  const raw =
    factors.evidenceCompleteness * 0.4 +
    factors.sourceReliability * 0.3 +
    factors.extractionConsistency * 0.3;

  const value = Math.max(0, Math.min(1, raw));

  return { value, class: classify(value), factors };
}

function classify(v: number): ConfidenceClass {
  if (v >= 0.9) return 'VERIFIED';
  if (v >= 0.7) return 'PROBABLE';
  if (v >= 0.5) return 'WEAK';
  return 'SUPPRESSED';
}

/**
 * Deterministic confidence — always 1.0.
 * Use for any metric extracted directly from a DOM attribute (title, meta, canonical,
 * heading count, word count, redirect chain, robots directives).
 * The ABSENCE of a field is itself a directly-observed fact and gets confidence 1.0.
 */
export const DETERMINISTIC_CONFIDENCE: ConfidenceScore = {
  value: 1.0,
  class: 'VERIFIED',
  factors: {
    evidenceCompleteness: 1.0,
    sourceReliability: 1.0,
    extractionConsistency: 1.0,
  },
};

/**
 * Compute source reliability from the types of evidence collected.
 *
 * Schema + DOM both confirm → 1.0
 * Direct DOM attribute (meta, link, title) → 0.9
 * Schema only → 0.8
 * Body text / heading → 0.65
 * LLM interpretation backed by DOM → 0.5
 * LLM only → 0.3
 */
export function computeSourceReliability(
  hasDomEvidence: boolean,
  hasSchemaEvidence: boolean,
  hasLlmEvidence: boolean,
): number {
  if (hasDomEvidence && hasSchemaEvidence) return 1.0;
  if (hasDomEvidence && !hasLlmEvidence) return 0.9;
  if (hasSchemaEvidence && !hasLlmEvidence) return 0.8;
  if (hasDomEvidence && hasLlmEvidence) return 0.5;
  if (hasLlmEvidence && !hasDomEvidence && !hasSchemaEvidence) return 0.3;
  return 0.65; // body text / heading only
}

/**
 * Compute extraction consistency from how many independent sources
 * confirm the same signal, and whether any conflict was detected.
 */
export function computeExtractionConsistency(
  sourceCount: number,
  conflictDetected: boolean,
): number {
  if (conflictDetected) return 0.3;
  if (sourceCount >= 3) return 1.0;
  if (sourceCount === 2) return 0.85;
  if (sourceCount === 1) return 0.7;
  return 0.3;
}
