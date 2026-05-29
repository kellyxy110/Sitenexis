import { type CrawledPage, type EntityIntelligenceReport } from '@sitenexis/shared';
import { analyzeEntityIntelligence } from '@sitenexis/analyzers';
import { saveIssues } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runEntityAgent(
  auditId: string,
  pages: CrawledPage[]
): Promise<EntityIntelligenceReport> {
  await emitAgentEvent({ auditId, agentId: 'entity', event: 'started' });

  const report = await analyzeEntityIntelligence(pages);

  // Save entity issues
  if (report.inconsistencies.length > 0) {
    await saveIssues(
      auditId,
      report.inconsistencies.map(({ severity, description, recommendation }) => ({
        module: 'entity',
        type: 'entity_issue',
        severity,
        message: description,
        recommendation,
      }))
    );
  }

  await emitAgentEvent({
    auditId,
    agentId: 'entity',
    event: 'completed',
    payload: {
      entitiesDetected: report.entitiesDetected.length,
      entityConfidenceScore: report.entityConfidenceScore,
    },
  });

  return report;
}
