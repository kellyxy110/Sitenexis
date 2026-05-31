import type {
  CrawledPage,
  EntityIntelligenceReport,
  CitationAnalysis,
  TemporalAuthorityResult,
} from '@sitenexis/shared';
import { runTemporalAuthorityAnalysis } from '@sitenexis/analyzers';
import { saveTemporalAuthorityRecord, getPageTextsByAudit, getAIVisibilityScore } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runTemporalAuthorityAgent(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
  citationAnalysis: CitationAnalysis,
  priorAuditId?: string,
): Promise<TemporalAuthorityResult> {
  await emitAgentEvent({ auditId, agentId: 'temporal-authority', event: 'started' });

  await emitAgentEvent({ auditId, agentId: 'temporal-authority', event: 'progress', payload: { stage: 'velocity' } });

  // Load prior audit data for velocity + drift calculation
  let priorAudit: Parameters<typeof runTemporalAuthorityAnalysis>[3] | undefined;
  if (priorAuditId) {
    const [priorAiVis, priorPageTexts] = await Promise.all([
      getAIVisibilityScore(priorAuditId).catch(() => null),
      getPageTextsByAudit(priorAuditId).catch(() => new Map<string, string>()),
    ]);
    if (priorAiVis) {
      priorAudit = {
        entityConfidenceScore: priorAiVis.entityConfidenceScore,
        citationProbabilityScore: priorAiVis.citationProbabilityScore,
        pageTexts: priorPageTexts,
      };
    }
  }

  await emitAgentEvent({ auditId, agentId: 'temporal-authority', event: 'progress', payload: { stage: 'drift' } });
  await emitAgentEvent({ auditId, agentId: 'temporal-authority', event: 'progress', payload: { stage: 'decay' } });
  await emitAgentEvent({ auditId, agentId: 'temporal-authority', event: 'progress', payload: { stage: 'freshness' } });

  const result = runTemporalAuthorityAnalysis(pages, entityReport, citationAnalysis, priorAudit);

  await saveTemporalAuthorityRecord(auditId, result);

  await emitAgentEvent({
    auditId,
    agentId: 'temporal-authority',
    event: 'completed',
    payload: {
      isBaseline: result.isBaseline,
      authorityVelocityScore: result.authorityVelocityScore,
      updateFrequency: result.updateFrequencyClassification,
    },
  });

  return result;
}
