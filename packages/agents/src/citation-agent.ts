import { type CrawledPage, type CitationAnalysis, type EntityIntelligenceReport } from '@sitenexis/shared';
import { analyzeCitationProbability } from '@sitenexis/analyzers';
import { saveIssues } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runCitationAgent(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport | null = null
): Promise<CitationAnalysis> {
  await emitAgentEvent({ auditId, agentId: 'citation', event: 'started' });

  const analysis = analyzeCitationProbability(pages, entityReport);

  // Save citation blockers as issues
  if (analysis.citationBlockers.length > 0) {
    await saveIssues(
      auditId,
      analysis.citationBlockers.slice(0, 10).map((blocker) => ({
        module: 'citation',
        type: 'citation_blocker',
        severity: 'warning' as const,
        message: blocker,
        recommendation: analysis.recommendations[0] ?? 'Improve content structure and factual density.',
      }))
    );
  }

  await emitAgentEvent({
    auditId,
    agentId: 'citation',
    event: 'completed',
    payload: {
      citationProbabilityScore: analysis.citationProbabilityScore,
      topCandidates: analysis.topCitationCandidates.length,
    },
  });

  return analysis;
}
