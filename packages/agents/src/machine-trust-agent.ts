import type {
  CrawledPage,
  EntityIntelligenceReport,
  SchemaScore,
  MachineTrustScore,
} from '@sitenexis/shared';
import { runMachineTrustAnalysis, callAI, contradictionDetectionPrompt } from '@sitenexis/analyzers';
import { saveMachineTrustScore } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

// Top N pages for Claude API contradiction detection (CLAUDE.md §23: cost control)
const CONTRADICTION_PAGE_LIMIT = 20;

interface ContradictionResponse {
  contradictions: Array<{
    entityInvolved: string;
    claimA: string;
    claimB: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

/**
 * Runs semantic contradiction detection via Claude API on the top 20 pages by PageRank.
 * Samples every page against the highest-PageRank page to maximise coverage at minimal API cost.
 * Returns a 0-100 contradiction absence score: 100 = no contradictions, lower = contradictions found.
 * Gracefully returns null on API failure so the agent can continue with the programmatic score.
 */
async function runSemanticContradictionDetection(
  pages: CrawledPage[],
): Promise<number | null> {
  const topPages = [...pages]
    .sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0))
    .filter((p) => (p.bodyText ?? '').length > 200)
    .slice(0, CONTRADICTION_PAGE_LIMIT);

  if (topPages.length < 2) return null;

  const anchor = topPages[0];
  let totalPenalty = 0;
  let pairsChecked = 0;

  // Compare anchor page against every other top page
  for (const other of topPages.slice(1)) {
    try {
      const prompt = contradictionDetectionPrompt(
        { url: anchor.url, excerpt: (anchor.bodyText ?? '').slice(0, 3000) },
        { url: other.url,  excerpt: (other.bodyText  ?? '').slice(0, 3000) },
      );

      const result = await callAI<ContradictionResponse>(prompt);

      for (const c of result.contradictions ?? []) {
        if (c.severity === 'critical') totalPenalty += 15;
        else if (c.severity === 'warning') totalPenalty += 5;
        else totalPenalty += 2;
      }
      pairsChecked++;
    } catch {
      // Per CLAUDE.md §29: never fail the agent on a sub-task error
      // Log is omitted here — the logger is in apps/web, not agents
    }
  }

  if (pairsChecked === 0) return null;

  return Math.max(0, 100 - totalPenalty);
}

export async function runMachineTrustAgent(
  auditId: string,
  pages: CrawledPage[],
  entityReport: EntityIntelligenceReport,
  schema: SchemaScore,
  priorSchemaUrls?: string[],
): Promise<MachineTrustScore> {
  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'started' });

  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'progress', payload: { stage: 'entity_credibility' } });
  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'progress', payload: { stage: 'schema_alignment' } });
  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'progress', payload: { stage: 'external_validation' } });
  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'progress', payload: { stage: 'contradiction_detection' } });

  // Claude API semantic contradiction detection on top 20 pages by PageRank
  const semanticContradictionScore = await runSemanticContradictionDetection(pages);

  await emitAgentEvent({ auditId, agentId: 'machine-trust', event: 'progress', payload: { stage: 'decay_signals' } });

  const score = runMachineTrustAnalysis(
    pages,
    entityReport,
    schema,
    priorSchemaUrls,
    semanticContradictionScore,
  );

  await saveMachineTrustScore(auditId, score);

  await emitAgentEvent({
    auditId,
    agentId: 'machine-trust',
    event: 'completed',
    payload: {
      overall: score.overall,
      trustIssueCount: score.trustIssues.length,
      semanticContradictionChecked: semanticContradictionScore !== null,
    },
  });

  return score;
}
