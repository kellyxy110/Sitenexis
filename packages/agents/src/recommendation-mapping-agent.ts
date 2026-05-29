// Stub — full implementation in a later prompt (Section 25 of CLAUDE.md)
import { type CrawledPage } from '@sitenexis/shared';
import { emitAgentEvent } from './registry';

export async function runRecommendationMappingAgent(
  auditId: string,
  _pages: CrawledPage[]
): Promise<void> {
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'started' });
  // Surfaces: AI Overviews, Chat Recommendation, Voice Retrieval, Agent Discovery
  // All scores are probabilistic estimates — never measured data
  // Surface parameters from /config/surface-coverage-model.json
  // External probes (HEAD requests): 5s timeout, fail → probeStatus: 'unreachable'
  await emitAgentEvent({ auditId, agentId: 'recommendation-mapping', event: 'completed' });
}
