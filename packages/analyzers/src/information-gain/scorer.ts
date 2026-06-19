import type {
  IGECohortPage,
  IGEQuestionGap,
  IGEEntityGap,
  IGEEvidenceGap,
  IGEScoreBreakdown,
} from '@sitenexis/shared';

/**
 * Computes the IGE Score (0-100) and sub-score breakdown.
 *
 * Formula:
 *   IGE Score =
 *     uniqueEntityScore    × 0.20   (unique entities / total target entities × 100)
 *     + uniqueQuestionScore × 0.25  (unclaimed + rare questions answered / total × 100)
 *     + uniqueEvidenceScore × 0.25  (target blocks vs cohort avg — bonus for being above average)
 *     + coverageScore      × 0.15   (% of universal questions target covers — cost of entry)
 *     + novelChunkScore    × 0.15   (% of target headings not matching any cohort heading)
 */
export function computeIGEScore(
  targetPage: IGECohortPage,
  cohortPages: IGECohortPage[],
  questionGap: IGEQuestionGap,
  entityGap: IGEEntityGap,
  evidenceGap: IGEEvidenceGap
): { score: number; breakdown: IGEScoreBreakdown } {
  const breakdown: IGEScoreBreakdown = {
    uniqueEntityScore: computeUniqueEntityScore(entityGap),
    uniqueQuestionScore: computeUniqueQuestionScore(questionGap),
    uniqueEvidenceScore: computeUniqueEvidenceScore(evidenceGap),
    novelChunkScore: computeNovelChunkScore(targetPage, cohortPages),
    coverageScore: computeCoverageScore(questionGap),
  };

  const score = Math.round(
    breakdown.uniqueEntityScore * 0.20 +
    breakdown.uniqueQuestionScore * 0.25 +
    breakdown.uniqueEvidenceScore * 0.25 +
    breakdown.coverageScore * 0.15 +
    breakdown.novelChunkScore * 0.15
  );

  return { score: clamp(score, 0, 100), breakdown };
}

/**
 * Computes PCE (Perception Confidence Engine) confidence score.
 *
 * Start at 1.0, deduct for each quality problem:
 * - -0.15 per page that failed to crawl
 * - -0.10 if cohort has < 5 successful pages
 * - -0.05 if average word count < 200
 * Clamped to [0.1, 1.0]
 */
export function computePCEConfidence(cohortPages: IGECohortPage[]): number {
  if (cohortPages.length === 0) return 0.1;

  let confidence = 1.0;

  // Penalize failed crawls
  const failedPages = cohortPages.filter((p) => !p.crawlSuccess);
  confidence -= failedPages.length * 0.15;

  // Penalize insufficient cohort
  const successfulPages = cohortPages.filter((p) => p.crawlSuccess);
  if (successfulPages.length < 5) {
    confidence -= 0.10;
  }

  // Penalize thin content
  if (successfulPages.length > 0) {
    const avgWordCount =
      successfulPages.reduce((sum, p) => sum + p.wordCount, 0) / successfulPages.length;
    if (avgWordCount < 200) {
      confidence -= 0.05;
    }
  }

  return Math.round(clamp(confidence, 0.1, 1.0) * 100) / 100;
}

// ── Sub-score calculators ─────────────────────────────────────────────────────

/**
 * Unique entity score: how many of the target's entities are not covered by cohort.
 * Score = (unique entities / total target entities) × 100
 */
function computeUniqueEntityScore(entityGap: IGEEntityGap): number {
  const totalTargetEntities =
    entityGap.targetUniqueEntities.length +
    entityGap.universalEntities.length +
    entityGap.commonEntities.length +
    entityGap.rareEntities.length;

  if (totalTargetEntities === 0) return 50; // No entities = neutral

  const uniqueCount = entityGap.targetUniqueEntities.length;
  return clamp(Math.round((uniqueCount / totalTargetEntities) * 100), 0, 100);
}

/**
 * Unique question score: what fraction of unclaimed + rare questions does the target answer?
 * Score = ((unclaimed_answered + rare_answered) / (unclaimed + rare)) × 100
 */
function computeUniqueQuestionScore(questionGap: IGEQuestionGap): number {
  const allRareAndUnclaimed = [
    ...questionGap.rareQuestions,
    // Unclaimed = questions only in target
    ...questionGap.coveredQuestions.filter((q) => q.tier === 'unclaimed'),
  ];

  const allUnclaimedFromRare = questionGap.rareQuestions;

  // Count unclaimed questions (tier = unclaimed that are covered by target)
  const unclaimedAnswered = questionGap.coveredQuestions.filter(
    (q) => q.tier === 'unclaimed' && q.coveredByTarget
  ).length;
  const rareAnswered = allRareAndUnclaimed.filter(
    (q) => q.tier === 'rare' && q.coveredByTarget
  ).length;

  const totalUnclaimedAndRare =
    questionGap.coveredQuestions.filter((q) => q.tier === 'unclaimed').length +
    allUnclaimedFromRare.length;

  if (totalUnclaimedAndRare === 0) return 50; // Neutral when no rare/unclaimed questions

  const score = Math.round(
    ((unclaimedAnswered + rareAnswered) / totalUnclaimedAndRare) * 100
  );
  return clamp(score, 0, 100);
}

/**
 * Unique evidence score: how does target's evidence density compare to cohort average?
 * Score = 50 (baseline) + bonus/penalty based on gap.
 * Above average = up to 100. Below average = down to 0.
 */
function computeUniqueEvidenceScore(evidenceGap: IGEEvidenceGap): number {
  const { cohortAverageBlocks, targetBlocks } = evidenceGap;

  if (cohortAverageBlocks === 0 && targetBlocks === 0) return 50;

  // Normalize the gap relative to cohort average
  if (cohortAverageBlocks === 0) {
    // Target has evidence, cohort has none — strong unique signal
    return Math.min(100, 50 + targetBlocks * 5);
  }

  const ratio = targetBlocks / cohortAverageBlocks;

  if (ratio >= 2.0) return 100;
  if (ratio >= 1.5) return 90;
  if (ratio >= 1.2) return 80;
  if (ratio >= 1.0) return 70;
  if (ratio >= 0.8) return 55;
  if (ratio >= 0.5) return 35;
  return 20;
}

/**
 * Coverage score: what fraction of universal questions does the target cover?
 * Measures cost-of-entry compliance — low coverage here hurts IGE even if unique content is strong.
 */
function computeCoverageScore(questionGap: IGEQuestionGap): number {
  const universalQuestions = questionGap.coveredQuestions.filter((q) => q.tier === 'universal');

  if (universalQuestions.length === 0) return 75; // No universal questions to cover — neutral-positive

  const covered = universalQuestions.filter((q) => q.coveredByTarget).length;
  return clamp(Math.round((covered / universalQuestions.length) * 100), 0, 100);
}

/**
 * Novel chunk score: what % of target headings don't match any cohort heading?
 * Measures topical novelty at the structural level.
 */
function computeNovelChunkScore(
  targetPage: IGECohortPage,
  cohortPages: IGECohortPage[]
): number {
  if (targetPage.headings.length === 0) return 50;

  const successfulCohort = cohortPages.filter((p) => p.crawlSuccess && p.url !== targetPage.url);
  if (successfulCohort.length === 0) return 75; // No cohort to compare against

  // Build cohort heading set (normalized)
  const cohortHeadings = new Set<string>();
  for (const page of successfulCohort) {
    for (const h of page.headings) {
      cohortHeadings.add(normalizeHeading(h));
    }
  }

  let novelCount = 0;
  for (const heading of targetPage.headings) {
    const normalized = normalizeHeading(heading);
    if (!cohortHeadings.has(normalized) && !isPartialMatch(normalized, cohortHeadings)) {
      novelCount++;
    }
  }

  return clamp(Math.round((novelCount / targetPage.headings.length) * 100), 0, 100);
}

function normalizeHeading(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Check if a heading has >= 70% word overlap with any cohort heading.
 */
function isPartialMatch(normalized: string, cohortHeadings: Set<string>): boolean {
  const words = new Set(normalized.split(' ').filter((w) => w.length > 3));
  if (words.size === 0) return false;

  for (const ch of cohortHeadings) {
    const chWords = ch.split(' ').filter((w) => w.length > 3);
    let shared = 0;
    for (const w of chWords) {
      if (words.has(w)) shared++;
    }
    const overlap = chWords.length > 0 ? shared / Math.max(words.size, chWords.length) : 0;
    if (overlap >= 0.7) return true;
  }
  return false;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
