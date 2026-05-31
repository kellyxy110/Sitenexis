import type { CrawledPage } from '@sitenexis/shared';
import type { Chunk } from './chunker';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RankingPressureResult {
  pageUrl: string;
  estimatedRankRange: [number, number];
  outrankedByHighAuthority: boolean;
  embeddingSimilarityEstimate: number;
  queryTypes: QueryTypeScore[];
}

export interface QueryTypeScore {
  queryType: string;
  rankingPressureScore: number;
  likelyPosition: 'top_3' | 'top_10' | 'beyond_10';
  reason: string;
}

// Query types from CLAUDE.md §32
const QUERY_TYPES = [
  'definitional',
  'comparative',
  'procedural',
  'evaluative',
  'factual',
  'navigational',
] as const;
type QueryType = typeof QUERY_TYPES[number];

// ─── Query-type signal detectors ──────────────────────────────────────────────

const QUERY_SIGNALS: Record<QueryType, {
  patterns: RegExp[];
  schemaTypes: string[];
  weight: number;
}> = {
  definitional: {
    patterns: [/\bwhat is\b/i, /\bdefined as\b/i, /\brefers to\b/i, /\bis a (type|kind|form) of\b/i],
    schemaTypes: ['Organization', 'Person', 'Product', 'WebPage'],
    weight: 0.20,
  },
  comparative: {
    patterns: [/\bvs\b/i, /\bversus\b/i, /\bcompared to\b/i, /\bbetter than\b/i, /\bdifference between\b/i],
    schemaTypes: ['Product', 'Review'],
    weight: 0.15,
  },
  procedural: {
    patterns: [/\bhow to\b/i, /\bsteps? to\b/i, /\bguide to\b/i, /\bprocess of\b/i, /^\d+\.\s/m],
    schemaTypes: ['HowTo'],
    weight: 0.15,
  },
  evaluative: {
    patterns: [/\breview\b/i, /\bpros? and cons?\b/i, /\bworth it\b/i, /\brating\b/i, /\btestimonial\b/i],
    schemaTypes: ['Review', 'Product'],
    weight: 0.15,
  },
  factual: {
    patterns: [/\bwhen was\b/i, /\bfounded in\b/i, /\bstatistic\b/i, /\bdata shows\b/i, /\b\d{4}\b/],
    schemaTypes: ['Organization', 'Event', 'Article'],
    weight: 0.20,
  },
  navigational: {
    patterns: [/\bin [a-z]+ (city|town|area|region)\b/i, /\bnear me\b/i, /\blocal\b/i, /\baddress\b/i],
    schemaTypes: ['LocalBusiness', 'Organization'],
    weight: 0.15,
  },
};

// ─── Ranking pressure simulation ─────────────────────────────────────────────

/**
 * Simulates retrieval ranking pressure for a page.
 * Estimates where this content would rank under competitive query pressure.
 *
 * No live queries made — all estimation is from content signals.
 */
export function simulateRankingPressure(
  page: CrawledPage,
  chunks: Chunk[],
): RankingPressureResult {
  const schemaTypes = extractSchemaTypes(page);
  const text = page.bodyText ?? '';

  const queryTypeScores: QueryTypeScore[] = QUERY_TYPES.map((queryType) => {
    return scoreQueryType(queryType, text, chunks, schemaTypes);
  });

  // Overall embedding similarity estimate — average of query type scores weighted by presence
  const totalWeight = queryTypeScores.reduce((sum, q) => sum + QUERY_SIGNALS[q.queryType as QueryType].weight, 0);
  const embeddingSimilarityEstimate = Math.round(
    queryTypeScores.reduce((sum, q) => {
      const w = QUERY_SIGNALS[q.queryType as QueryType].weight;
      return sum + q.rankingPressureScore * w;
    }, 0) / (totalWeight || 1),
  );

  // A site with <50 embedding similarity is likely outranked by high-authority sources
  const outrankedByHighAuthority = embeddingSimilarityEstimate < 50;

  // Rank range estimate — lower is better
  const rankRange = estimateRankRange(embeddingSimilarityEstimate);

  return {
    pageUrl: page.url,
    estimatedRankRange: rankRange,
    outrankedByHighAuthority,
    embeddingSimilarityEstimate,
    queryTypes: queryTypeScores,
  };
}

function scoreQueryType(
  queryType: QueryType,
  text: string,
  chunks: Chunk[],
  schemaTypes: string[],
): QueryTypeScore {
  const signals = QUERY_SIGNALS[queryType];
  let score = 0;

  // Pattern matching in body text
  const matchCount = signals.patterns.filter((p) => p.test(text)).length;
  score += Math.min(matchCount / signals.patterns.length, 1) * 50;

  // Schema type presence
  const schemaMatch = signals.schemaTypes.some((t) => schemaTypes.includes(t));
  if (schemaMatch) score += 25;

  // Self-contained chunks for this query type
  const selfContainedCount = chunks.filter((c) => c.isSelfContained).length;
  const chunkRatio = chunks.length > 0 ? selfContainedCount / chunks.length : 0;
  score += chunkRatio * 25;

  score = Math.round(Math.min(100, score));

  const likelyPosition: QueryTypeScore['likelyPosition'] =
    score >= 70 ? 'top_3' : score >= 45 ? 'top_10' : 'beyond_10';

  const reason = buildRankingReason(queryType, matchCount, schemaMatch, score);

  return {
    queryType,
    rankingPressureScore: score,
    likelyPosition,
    reason,
  };
}

function estimateRankRange(embeddingSimilarity: number): [number, number] {
  if (embeddingSimilarity >= 80) return [1, 3];
  if (embeddingSimilarity >= 65) return [3, 7];
  if (embeddingSimilarity >= 50) return [5, 12];
  if (embeddingSimilarity >= 35) return [10, 25];
  return [20, 50];
}

function buildRankingReason(
  queryType: QueryType,
  matchCount: number,
  schemaMatch: boolean,
  score: number,
): string {
  if (score >= 70) return `Strong ${queryType} signals: ${matchCount} pattern matches${schemaMatch ? ' + matching schema' : ''}.`;
  if (score >= 45) return `Moderate ${queryType} signals: some pattern matches${schemaMatch ? ' + schema present' : ', schema absent'}.`;
  return `Weak ${queryType} signals: content does not directly address this query type.`;
}

function extractSchemaTypes(page: CrawledPage): string[] {
  const types: string[] = [];
  for (const markup of page.schemaMarkup ?? []) {
    if (markup && typeof markup === 'object' && '@type' in markup) {
      const t = (markup as Record<string, unknown>)['@type'];
      if (typeof t === 'string') types.push(t);
      if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'));
    }
  }
  return types;
}
