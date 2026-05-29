import {
  type CrawledPage,
  type SemanticTrustScore,
  type EntityIntelligenceReport,
  type SchemaScore,
} from '@sitenexis/shared';
import { analyzeSemanticTrust } from '@sitenexis/analyzers';
import { saveIssues } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

export async function runSemanticTrustAgent(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport | null = null,
  schemaScore: SchemaScore | null = null
): Promise<SemanticTrustScore> {
  await emitAgentEvent({ auditId, agentId: 'semantic-trust', event: 'started' });

  const trustScore = await analyzeSemanticTrust(pages, entityReport, schemaScore);

  // Save trust issues
  if (trustScore.issues.length > 0) {
    await saveIssues(
      auditId,
      trustScore.issues
        .filter((issue) => issue.severity === 'critical' || issue.severity === 'warning')
        .slice(0, 20)
        .map(({ severity, description, recommendation }) => ({
          module: 'semantic-trust',
          type: 'trust_issue',
          severity,
          message: description,
          recommendation,
        }))
    );
  }

  await emitAgentEvent({
    auditId,
    agentId: 'semantic-trust',
    event: 'completed',
    payload: {
      score: trustScore.score,
      issueCount: trustScore.issues.length,
      breakdown: trustScore.breakdown,
    },
  });

  return trustScore;
}
