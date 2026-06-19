import type { IGECohortPage, IGEEvidenceGap, IGEEvidenceBlock } from '@sitenexis/shared';

type EvidenceType = IGEEvidenceBlock['type'];

/**
 * Computes the evidence gap between cohort pages and the target page.
 *
 * Algorithm:
 * - Count evidence blocks per page, compute cohort average
 * - Compare target block count to cohort average
 * - List evidence types present in cohort but absent from target as missingTypes
 */
export function detectEvidenceGap(
  cohortPages: IGECohortPage[],
  targetPage: IGECohortPage
): IGEEvidenceGap {
  const successfulCohort = cohortPages.filter((p) => p.crawlSuccess && p.url !== targetPage.url);

  // Cohort type counts
  const cohortTypeCounts: Partial<Record<EvidenceType, number>> = {};

  let totalCohortBlocks = 0;
  for (const page of successfulCohort) {
    totalCohortBlocks += page.evidenceBlocks.length;
    for (const block of page.evidenceBlocks) {
      cohortTypeCounts[block.type] = (cohortTypeCounts[block.type] ?? 0) + 1;
    }
  }

  const cohortAverageBlocks =
    successfulCohort.length > 0
      ? Math.round((totalCohortBlocks / successfulCohort.length) * 10) / 10
      : 0;

  // Target type counts
  const targetTypeCounts: Partial<Record<EvidenceType, number>> = {};
  for (const block of targetPage.evidenceBlocks) {
    targetTypeCounts[block.type] = (targetTypeCounts[block.type] ?? 0) + 1;
  }

  const targetBlocks = targetPage.evidenceBlocks.length;
  const evidenceGap = cohortAverageBlocks - targetBlocks; // positive means target is below average

  // Missing types: present in cohort but absent from target
  const allEvidenceTypes: EvidenceType[] = [
    'statistic', 'benchmark', 'case_study', 'experiment',
    'dataset', 'framework', 'example',
  ];

  const missingTypes: EvidenceType[] = [];
  for (const type of allEvidenceTypes) {
    const cohortHasType = (cohortTypeCounts[type] ?? 0) > 0;
    const targetHasType = (targetTypeCounts[type] ?? 0) > 0;
    if (cohortHasType && !targetHasType) {
      missingTypes.push(type);
    }
  }

  return {
    cohortAverageBlocks,
    targetBlocks,
    evidenceGap,
    cohortTypeCounts,
    targetTypeCounts,
    missingTypes,
  };
}
