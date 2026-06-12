import type { CrawledPage, EntityIntelligenceReport } from '@sitenexis/shared';

export interface SemanticDensityResult {
  score: number;
  rawDensity: number;
  breakdown: {
    entityCount: number;
    factCount: number;
    relationshipCount: number;
    totalWords: number;
  };
}

const MONTH_PATTERN =
  /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i;

function countFacts(pages: CrawledPage[]): number {
  let count = 0;
  for (const page of pages) {
    const sentences = page.bodyText.split(/[.!?]+/).filter((s) => s.trim().length > 10);
    for (const sentence of sentences) {
      if (/\d+/.test(sentence) || MONTH_PATTERN.test(sentence)) {
        count++;
      }
    }
  }
  return count;
}

export function computeSemanticDensity(
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
  relationshipCount = 0,
): SemanticDensityResult {
  const totalWords = pages.reduce((s, p) => s + p.wordCount, 0);
  const entityCount = entityReport.entitiesDetected.length;
  const factCount = countFacts(pages);

  if (totalWords === 0) {
    return {
      score: 0,
      rawDensity: 0,
      breakdown: { entityCount, factCount, relationshipCount, totalWords },
    };
  }

  // SDS = (entities + facts + relationships) / words × 1000
  const rawDensity = ((entityCount + factCount + relationshipCount) / totalWords) * 1000;

  // Normalise: density of 25 per 1000 words maps to score 100
  const score = Math.round(Math.min(100, (rawDensity / 25) * 100));

  return {
    score,
    rawDensity: Math.round(rawDensity * 100) / 100,
    breakdown: { entityCount, factCount, relationshipCount, totalWords },
  };
}
