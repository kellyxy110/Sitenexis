import { type CrawledPage, type PerformanceScore } from '@sitenexis/shared';
import { analyzePerformance } from '@sitenexis/analyzers';
import { saveIssues } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runPerformanceAgent(
  auditId: string,
  pages: CrawledPage[]
): Promise<PerformanceScore> {
  await emitAgentEvent({ auditId, agentId: 'performance', event: 'started' });

  const score = await analyzePerformance(pages);

  await saveIssues(
    auditId,
    score.issues.map(({ severity, message, recommendation }) => ({
      severity, message, recommendation, module: 'performance', type: 'performance_issue',
    }))
  );

  await emitAgentEvent({
    auditId,
    agentId: 'performance',
    event: 'completed',
    payload: { score: score.score, ttfb: score.ttfb },
  });

  return score;
}
