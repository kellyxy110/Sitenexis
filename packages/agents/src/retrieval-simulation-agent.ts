import type { CrawledPage, RetrievalSimulationResult, GraphNode } from '@sitenexis/shared';
import { runRetrievalSimulation } from '@sitenexis/analyzers';
import { saveRetrievalSimulations } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runRetrievalSimulationAgent(
  auditId: string,
  pages: CrawledPage[],
  pageRankNodes?: GraphNode[],
): Promise<RetrievalSimulationResult[]> {
  await emitAgentEvent({ auditId, agentId: 'retrieval-simulation', event: 'started' });

  const results = runRetrievalSimulation(pages, pageRankNodes);

  for (let i = 0; i < results.length; i += 5) {
    const batch = results.slice(i, i + 5);
    await emitAgentEvent({
      auditId,
      agentId: 'retrieval-simulation',
      event: 'progress',
      payload: {
        pagesSimulated: Math.min(i + 5, results.length),
        totalPages: results.length,
        batch: batch.map((r) => ({ url: r.pageUrl, score: r.retrievalQualityScore, simulated: r.simulated })),
      },
    });
  }

  await saveRetrievalSimulations(auditId, results);

  const scored = results.filter((r) => r.retrievalQualityScore !== null);
  const avgScore = scored.length > 0
    ? Math.round(scored.reduce((s, r) => s + (r.retrievalQualityScore ?? 0), 0) / scored.length)
    : null;

  await emitAgentEvent({
    auditId,
    agentId: 'retrieval-simulation',
    event: 'completed',
    payload: { pagesSimulated: results.filter((r) => r.simulated).length, avgRetrievalQualityScore: avgScore },
  });

  return results;
}
