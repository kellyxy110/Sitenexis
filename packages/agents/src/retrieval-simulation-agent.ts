// Stub — full implementation in a later prompt (Section 22 of CLAUDE.md)
import { type CrawledPage } from '@sitenexis/shared';
import { emitAgentEvent } from './registry';

export async function runRetrievalSimulationAgent(
  auditId: string,
  _pages: CrawledPage[]
): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'retrieval-simulation', event: 'started' });
  // Runs on top 30 pages by PageRank only (compute cost control)
  // Deterministic simulation: chunk extraction → ranking pressure → summarisation
  // → context truncation → answer formation → citation eligibility
  // Parameters from /config/retrieval-simulation-model.json
  // Partial failure: log + skip page, never fail entire agent
  await emitAgentEvent({ auditId, agentId: 'retrieval-simulation', event: 'completed' });
}
