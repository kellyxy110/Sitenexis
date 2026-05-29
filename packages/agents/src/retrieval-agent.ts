import { type CrawledPage, type AIReadabilityScore } from '@sitenexis/shared';
import { analyzeAIReadability } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';

export async function runRetrievalAgent(
  auditId: string,
  pages: CrawledPage[]
): Promise<AIReadabilityScore> {
  await emitAgentEvent({ auditId, agentId: 'retrieval', event: 'started' });

  const score = await analyzeAIReadability(pages);

  await emitAgentEvent({
    auditId,
    agentId: 'retrieval',
    event: 'completed',
    payload: { score: score.score },
  });

  return score;
}
