import type {
  CrawledPage,
  EntityIntelligenceReport,
  SyntheticEntityAnalysis,
} from '@sitenexis/shared';
import { runSyntheticEntityDetection } from '@sitenexis/analyzers';
import { saveSyntheticEntityAnalysis } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runSyntheticEntityAgent(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
): Promise<SyntheticEntityAnalysis> {
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'started' });

  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'progress', payload: { category: 'fake_entity' } });
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'progress', payload: { category: 'authority_network' } });
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'progress', payload: { category: 'schema_manipulation' } });
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'progress', payload: { category: 'citation_farming' } });
  await emitAgentEvent({ auditId, agentId: 'synthetic-entity', event: 'progress', payload: { category: 'unnatural_clustering' } });

  const analysis = runSyntheticEntityDetection(pages, entityReport);

  await saveSyntheticEntityAnalysis(auditId, analysis);

  await emitAgentEvent({
    auditId,
    agentId: 'synthetic-entity',
    event: 'completed',
    payload: {
      riskScore: analysis.syntheticRiskScore,
      authenticityConfidence: analysis.entityAuthenticityConfidence,
      patternsDetected: analysis.detectedPatterns.filter((p) => p.confidence > 0).length,
    },
  });

  return analysis;
}
