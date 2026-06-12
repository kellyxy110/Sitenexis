import type {
  CrawledPage,
  EntityIntelligenceReport,
  SchemaScore,
  MachineTrustScore,
} from '@sitenexis/shared';
import {
  runMachineTrustAnalysis,
  callAI,
  contradictionDetectionPrompt,
  detectContradictionsWithDeepSeek,
  isAnyOpenRouterAvailable,
} from '@sitenexis/analyzers';
import { saveMachineTrustScore } from '@sitenexis/db';
import { emitAgentEvent } from './registry';

// Top N pages for pairwise fallback (used only when DeepSeek is not available)
const CONTRADICTION_PAGE_LIMIT_FALLBACK = 20;

interface ContradictionResponse {
  contradictions: Array<{
    entityInvolved: string;
    claimA: string;
    claimB: string;
    severity: 'critical' | 'warning' | 'info';
  }>;
}

/**
 * Pairwise fallback: used when DeepSeek is not configured.
 * Runs callAI (Hermes 3 or Groq) on top 20 pages pairwise.
 */
async function runPairwiseContradictionDetection(
  pages: CrawledPage[],
): Promise<number | null> {
  const topPages = [...pages]
    .sort((a, b) => (b.wordCount ?? 0) - (a.wordCount ?? 0))
    .filter((p) => (p.bodyText ?? '').length > 200)
    .slice(0, CONTRADICTION_PAGE_LIMIT_FALLBACK);

  if (topPages.length < 2) return null;

  const anchor = topPages[0];
  let totalPenalty = 0;
  let pairsChecked = 0;

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
    }
  }

  return pairsChecked === 0 ? null : Math.max(0, 100 - totalPenalty);
}

/**
 * Runs semantic contradiction detection across all crawled pages.
 *
 * Strategy:
 *   1. DeepSeek V4 Flash (1M context) — whole-site analysis, all pages, single call
 *   2. Hermes 3 / Groq pairwise — top 20 pages pairwise (when DeepSeek unavailable)
 *   3. null — returns null so engine uses programmatic score
 */
async function runSemanticContradictionDetection(
  pages: CrawledPage[],
): Promise<number | null> {
  const meaningfulPages = pages.filter((p) => (p.bodyText ?? '').length > 200);
  if (meaningfulPages.length < 2) return null;

  // Path 1: DeepSeek whole-site analysis (preferred — all pages, 1M context)
  if (isAnyOpenRouterAvailable()) {
    const deepResult = await detectContradictionsWithDeepSeek(meaningfulPages);
    if (deepResult.analysisSource === 'deepseek') {
      return deepResult.score;
    }
  }

  // Path 2: Pairwise fallback using Hermes 3 or Groq (top 20 pages)
  return runPairwiseContradictionDetection(meaningfulPages);
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
