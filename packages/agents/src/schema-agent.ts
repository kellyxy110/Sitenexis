import { type CrawledPage, type SchemaScore } from '@sitenexis/shared';
import { saveIssues } from '@sitenexis/db';
import { analyzeSchema } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';

export async function runSchemaAgent(auditId: string, pages: CrawledPage[]): Promise<SchemaScore> {
  await emitAgentEvent({ auditId, agentId: 'schema', event: 'started' });

  const score = analyzeSchema(pages);

  await saveIssues(
    auditId,
    score.issues.map(({ severity, message, recommendation }) => ({
      severity, message, recommendation, module: 'schema', type: 'schema_issue',
    }))
  );

  await emitAgentEvent({
    auditId,
    agentId: 'schema',
    event: 'completed',
    payload: { score: score.score, detectedTypes: score.detectedTypes },
  });

  return score;
}
