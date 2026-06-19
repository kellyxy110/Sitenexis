import type { IGERetrievalValue } from '@sitenexis/shared';

/**
 * Estimates the retrieval value of the target page based on IGE score + evidence density.
 *
 * - high: score >= 65 OR targetBlocks >= 5
 * - medium: score >= 40 OR targetBlocks >= 2
 * - low: below both thresholds
 */
export function estimateRetrievalValue(
  igeScore: number,
  evidenceGap: { targetBlocks: number }
): IGERetrievalValue {
  const { targetBlocks } = evidenceGap;

  if (igeScore >= 65 || targetBlocks >= 5) return 'high';
  if (igeScore >= 40 || targetBlocks >= 2) return 'medium';
  return 'low';
}
