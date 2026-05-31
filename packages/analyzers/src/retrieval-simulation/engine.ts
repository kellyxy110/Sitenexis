import type { CrawledPage, RetrievalSimulationResult } from '@sitenexis/shared';
import type { GraphNode } from '@sitenexis/shared';
import { measureChunkStability } from './chunker';
import { simulateRankingPressure } from './ranker';
import { analyseSummarisationDegradation } from './summarizer';
import { scoreRetrievalQuality } from './scorer';

export { measureChunkStability } from './chunker';
export { simulateRankingPressure } from './ranker';
export { analyseSummarisationDegradation } from './summarizer';
export { scoreRetrievalQuality } from './scorer';

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Runs the full 6-stage retrieval simulation for a set of pages.
 *
 * Per CLAUDE.md §22: Simulation is deterministic and algorithmic — no live
 * AI queries. Limited to top 30 pages by PageRank (compute cost control).
 * Pages that error are marked simulated:false with a reason rather than
 * failing the entire run.
 */
export function runRetrievalSimulation(
  pages: CrawledPage[],
  pageRankNodes?: GraphNode[],
): RetrievalSimulationResult[] {
  // Sort by PageRank descending and take top 30
  const prioritised = prioritiseByPageRank(pages, pageRankNodes).slice(0, 30);

  const results: RetrievalSimulationResult[] = [];

  for (const page of prioritised) {
    try {
      const result = simulatePage(page);
      results.push(result);
    } catch (err) {
      results.push({
        pageUrl: page.url,
        simulated: false,
        simulationErrorReason: err instanceof Error ? err.message : String(err),
        retrievalQualityScore: null,
        chunkStabilityIndex: null,
        answerFormationProbability: null,
        summarisationLossScore: null,
        citationEligibilityScore: null,
        retrievalFailureReasons: [],
        truncationZoneWarnings: [],
        fragileClaimsCount: 0,
      });
    }
  }

  return results;
}

function simulatePage(page: CrawledPage): RetrievalSimulationResult {
  // Stage 1+3: Chunk extraction + stability (3 boundary strategies)
  const stability = measureChunkStability(page);

  // Stage 2: Retrieval ranking pressure simulation
  const ranking = simulateRankingPressure(page, stability.chunks);

  // Stage 3+4: Summarisation degradation + truncation modeling
  const summarisation = analyseSummarisationDegradation(
    page.url,
    stability.chunks,
    page.bodyText ?? '',
  );

  // Stage 5+6: Answer formation probability + Citation eligibility filtering
  return scoreRetrievalQuality(stability, ranking, summarisation);
}

function prioritiseByPageRank(
  pages: CrawledPage[],
  pageRankNodes?: GraphNode[],
): CrawledPage[] {
  if (!pageRankNodes || pageRankNodes.length === 0) {
    return [...pages];
  }

  const rankMap = new Map(pageRankNodes.map((n) => [n.url, n.pageRank]));

  return [...pages].sort((a, b) => {
    const rankA = rankMap.get(a.url) ?? 0;
    const rankB = rankMap.get(b.url) ?? 0;
    return rankB - rankA;
  });
}
