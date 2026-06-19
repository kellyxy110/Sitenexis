import type { IGECohortPage, IGESharedKnowledge } from '@sitenexis/shared';

/**
 * Detects shared knowledge across cohort pages.
 *
 * Algorithm:
 * 1. Extract topic keywords from each page's headings (h1-h3, already parsed into IGECohortPage.headings)
 * 2. For each unique topic, count how many pages mention it
 * 3. Topics covered by >= 60% of pages = "shared knowledge"
 * 4. Compute sharedCoveragePercent = (shared_topic_count / total_topic_count) * 100
 */
export function detectSharedKnowledge(cohortPages: IGECohortPage[]): IGESharedKnowledge {
  const successfulPages = cohortPages.filter((p) => p.crawlSuccess);

  if (successfulPages.length === 0) {
    return { sharedCoveragePercent: 0, sharedTopics: [] };
  }

  const total = successfulPages.length;

  // Build a frequency map: topic -> count of pages containing it
  const topicPageCount = new Map<string, number>();

  for (const page of successfulPages) {
    // Get unique topic keywords from this page's headings
    const pageTopics = new Set<string>();
    for (const heading of page.headings) {
      for (const keyword of extractTopicKeywords(heading)) {
        pageTopics.add(keyword);
      }
    }
    // Increment count for each unique topic this page covers
    for (const topic of pageTopics) {
      topicPageCount.set(topic, (topicPageCount.get(topic) ?? 0) + 1);
    }
  }

  if (topicPageCount.size === 0) {
    return { sharedCoveragePercent: 0, sharedTopics: [] };
  }

  const SHARED_THRESHOLD = 0.6; // >= 60% of pages

  const sharedTopics: IGESharedKnowledge['sharedTopics'] = [];
  let sharedCount = 0;

  for (const [topic, count] of topicPageCount.entries()) {
    const coveragePercent = (count / total) * 100;
    const isShared = count / total >= SHARED_THRESHOLD;
    if (isShared) sharedCount++;
    sharedTopics.push({ topic, coverageCount: count, coveragePercent });
  }

  // Sort by coverage descending
  sharedTopics.sort((a, b) => b.coverageCount - a.coverageCount);

  const sharedCoveragePercent =
    topicPageCount.size > 0 ? (sharedCount / topicPageCount.size) * 100 : 0;

  return {
    sharedCoveragePercent: Math.round(sharedCoveragePercent * 10) / 10,
    sharedTopics: sharedTopics.slice(0, 50), // Return top 50 topics
  };
}

/**
 * Extracts normalized topic keywords from a heading string.
 * Splits on spaces, lowercases, strips punctuation, filters stopwords and short words.
 */
function extractTopicKeywords(heading: string): string[] {
  const STOPWORDS = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'can', 'it', 'its', 'this', 'that',
    'these', 'those', 'what', 'how', 'why', 'when', 'where', 'who', 'which',
    'your', 'our', 'their', 'we', 'you', 'i', 'he', 'she', 'they', 'not',
    'all', 'more', 'most', 'also', 'into', 'than', 'then', 'if', 'so',
  ]);

  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));
}
