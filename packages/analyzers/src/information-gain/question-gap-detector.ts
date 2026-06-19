import type { IGECohortPage, IGEQuestionGap, IGEQuestionCoverage } from '@sitenexis/shared';

/**
 * Builds a SERP Question Graph from all cohort pages (including target)
 * and detects coverage gaps.
 *
 * ZFDA enforcement: only processes questions that were actually crawled from real pages.
 */
export function detectQuestionGaps(
  cohortPages: IGECohortPage[],
  targetPage: IGECohortPage
): IGEQuestionGap {
  const successfulCohort = cohortPages.filter((p) => p.crawlSuccess && p.url !== targetPage.url);
  const totalPages = successfulCohort.length;

  if (totalPages === 0) {
    // No cohort data — can still report target's questions but no tier info
    const allTargetQs = targetPage.questions.map<IGEQuestionCoverage>((q) => ({
      question: q.text,
      coverageCount: 0,
      coveragePercent: 0,
      coveredByTarget: true,
      tier: 'unclaimed',
      opportunity: 'critical',
    }));
    return {
      totalQuestionsExtracted: allTargetQs.length,
      coveredQuestions: [],
      rareQuestions: allTargetQs,
      unansweredQuestions: [],
    };
  }

  // ── Pool all questions from cohort pages ──────────────────────────────────
  // Map: normalized question text -> list of page URLs that have it
  const questionPageMap = new Map<string, Set<string>>();
  // Also store canonical text (first seen)
  const canonicalText = new Map<string, string>();

  for (const page of successfulCohort) {
    for (const q of page.questions) {
      const key = normalizeQuestionText(q.text);
      if (!key) continue;
      if (!questionPageMap.has(key)) {
        questionPageMap.set(key, new Set());
        canonicalText.set(key, q.text);
      }
      questionPageMap.get(key)!.add(page.url);
    }
  }

  // Also add target questions to the pool for coverage check
  const targetQuestionKeys = new Set<string>();
  for (const q of targetPage.questions) {
    const key = normalizeQuestionText(q.text);
    if (key) targetQuestionKeys.add(key);
  }

  // Add target questions to the map if not already present (but don't count target as a cohort page)
  for (const q of targetPage.questions) {
    const key = normalizeQuestionText(q.text);
    if (!key) continue;
    if (!questionPageMap.has(key)) {
      questionPageMap.set(key, new Set());
      canonicalText.set(key, q.text);
    }
  }

  // ── Build coverage records ─────────────────────────────────────────────────
  const allCoverages: IGEQuestionCoverage[] = [];

  for (const [key, pageSet] of questionPageMap.entries()) {
    const coverageCount = pageSet.size;
    const coveragePercent = (coverageCount / totalPages) * 100;
    const coveredByTarget = targetQuestionKeys.has(key) || isAnsweredByTarget(key, targetPage);

    // Deduplicate via substring overlap
    const tier = computeTier(coverageCount, totalPages);
    const opportunity = computeOpportunity(tier, coveredByTarget);

    allCoverages.push({
      question: canonicalText.get(key) ?? key,
      coverageCount,
      coveragePercent: Math.round(coveragePercent * 10) / 10,
      coveredByTarget,
      tier,
      opportunity,
    });
  }

  // Sort by coverage descending
  allCoverages.sort((a, b) => b.coverageCount - a.coverageCount);

  const coveredQuestions = allCoverages.filter(
    (q) => q.tier === 'universal' || q.tier === 'common'
  );
  const rareQuestions = allCoverages.filter((q) => q.tier === 'rare');
  const unansweredQuestions = allCoverages.filter(
    (q) => !q.coveredByTarget && (q.tier === 'universal' || q.tier === 'common')
  );

  return {
    totalQuestionsExtracted: questionPageMap.size,
    coveredQuestions,
    rareQuestions,
    unansweredQuestions,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize question text for deduplication.
 * Returns empty string if the result is too short.
 */
function normalizeQuestionText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a question key is covered by the target page using substring overlap.
 */
function isAnsweredByTarget(questionKey: string, targetPage: IGECohortPage): boolean {
  for (const q of targetPage.questions) {
    const targetKey = normalizeQuestionText(q.text);
    if (targetKey === questionKey) return true;
    // Substring overlap >= 60%
    const overlap = substringOverlap(questionKey, targetKey);
    if (overlap >= 0.6) return true;
  }
  return false;
}

/**
 * Computes the proportion of the shorter string that appears in the longer one.
 */
function substringOverlap(a: string, b: string): number {
  if (!a || !b) return 0;
  const shorter = a.length <= b.length ? a : b;
  const longer = a.length <= b.length ? b : a;
  if (longer.includes(shorter)) return 1.0;
  // Word-level overlap
  const aWords = new Set(a.split(' ').filter((w) => w.length > 3));
  const bWords = new Set(b.split(' ').filter((w) => w.length > 3));
  if (aWords.size === 0 || bWords.size === 0) return 0;
  let shared = 0;
  for (const word of aWords) {
    if (bWords.has(word)) shared++;
  }
  return shared / Math.max(aWords.size, bWords.size);
}

function computeTier(coverageCount: number, totalPages: number): IGEQuestionCoverage['tier'] {
  if (totalPages === 0) return 'unclaimed';
  const ratio = coverageCount / totalPages;
  if (ratio >= 0.7) return 'universal';
  if (ratio >= 0.4) return 'common';
  if (ratio >= 0.1) return 'rare';
  return 'unclaimed';
}

function computeOpportunity(
  tier: IGEQuestionCoverage['tier'],
  coveredByTarget: boolean
): IGEQuestionCoverage['opportunity'] {
  if (tier === 'unclaimed') return coveredByTarget ? 'medium' : 'critical';
  if (tier === 'rare') return coveredByTarget ? 'low' : 'high';
  if (tier === 'common') return coveredByTarget ? 'low' : 'medium';
  // universal
  return 'low';
}
