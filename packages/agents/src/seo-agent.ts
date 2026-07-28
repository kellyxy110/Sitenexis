import { type CrawledPage, type SEOScore } from '@sitenexis/shared';
import { saveIssues } from '@sitenexis/db';
import { analyzeSEO } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';

export async function runSEOAgent(auditId: string, pages: CrawledPage[]): Promise<SEOScore> {
  await emitAgentEvent({ auditId, agentId: 'seo', event: 'started' });

  const { score, issues } = analyzeSEO(pages);

  await saveIssues(
    auditId,
    issues.map(({ type, severity, message, recommendation, url, problem, solution }) => ({
      type, severity, message, recommendation, module: 'seo', pageUrl: url,
      ...(problem ? { problem } : {}),
      ...(solution ? { solution } : {}),
    }))
  );

  await emitAgentEvent({
    auditId,
    agentId: 'seo',
    event: 'completed',
    payload: { score: score.score, issueCount: issues.length },
  });

  return score;
}
