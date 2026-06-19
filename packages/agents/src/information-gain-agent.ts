import { runIGEEngine } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';

export interface IGEAgentInput {
  auditId: string;
  keyword: string;
  targetUrl: string;
}

/**
 * Information Gain Agent
 *
 * Runs IGE analysis for a completed audit.
 * Emits agent:progress, agent:completed, or agent:failed.
 * Implements graceful partial failure: if SERP collection fails, saves an empty result
 * rather than failing the entire job.
 */
export async function runInformationGainAgent(input: IGEAgentInput): Promise<void> {
  const { auditId, keyword, targetUrl } = input;

  await emitAgentEvent({ auditId, agentId: 'information-gain', event: 'started' });

  let result;

  try {
    await emitAgentEvent({
      auditId,
      agentId: 'information-gain',
      event: 'progress',
      payload: { stage: 'serp_collection', keyword },
    });

    result = await runIGEEngine({ keyword, targetUrl });

    await emitAgentEvent({
      auditId,
      agentId: 'information-gain',
      event: 'progress',
      payload: {
        stage: 'analysis_complete',
        state: result.state,
        cohortPagesSuccessful: result.cohortPagesSuccessful,
        informationGainScore: result.informationGainScore,
        confidence: result.confidence,
      },
    });
  } catch (engineError: unknown) {
    const msg = engineError instanceof Error ? engineError.message : String(engineError);
    await emitAgentEvent({
      auditId,
      agentId: 'information-gain',
      event: 'failed',
      errorMessage: `IGE engine error: ${msg}`,
    });
    // Graceful: still try to save an empty result rather than leaving nothing
    try {
      const { saveIGEResult } = await import('@sitenexis/db');
      await saveIGEResult(auditId, {
        state: 'empty',
        timestamp: new Date().toISOString(),
        reason: `Engine error: ${msg}`,
        keyword,
        targetUrl,
        cohortSize: 0,
        cohortPagesSuccessful: 0,
        cohortQualityScore: 0,
        informationGainScore: 0,
        confidence: 0,
        scoreBreakdown: {
          uniqueEntityScore: 0,
          uniqueQuestionScore: 0,
          uniqueEvidenceScore: 0,
          novelChunkScore: 0,
          coverageScore: 0,
        },
        sharedKnowledge: { sharedCoveragePercent: 0, sharedTopics: [] },
        questionGap: {
          totalQuestionsExtracted: 0,
          coveredQuestions: [],
          rareQuestions: [],
          unansweredQuestions: [],
        },
        entityGap: {
          universalEntities: [],
          commonEntities: [],
          rareEntities: [],
          targetUniqueEntities: [],
          missingFromTarget: [],
        },
        evidenceGap: {
          cohortAverageBlocks: 0,
          targetBlocks: 0,
          evidenceGap: 0,
          cohortTypeCounts: {},
          targetTypeCounts: {},
          missingTypes: [],
        },
        retrievalValue: 'low',
        citationOpportunities: [],
        factLayer: {
          extractedQuestions: [],
          extractedEntities: [],
          extractedEvidence: [],
          sourcedFromUrls: [],
        },
        perceptionLayer: {
          inferredThemes: [],
          inferredOpportunities: [],
          perceptionConfidence: 0,
        },
      });
    } catch {
      // Swallow — we already emitted failed
    }
    return;
  }

  // Save result to DB
  try {
    const { saveIGEResult } = await import('@sitenexis/db');
    await saveIGEResult(auditId, result);
  } catch (dbError: unknown) {
    const msg = dbError instanceof Error ? dbError.message : String(dbError);
    await emitAgentEvent({
      auditId,
      agentId: 'information-gain',
      event: 'failed',
      errorMessage: `Failed to save IGE result to DB: ${msg}`,
    });
    return;
  }

  await emitAgentEvent({
    auditId,
    agentId: 'information-gain',
    event: 'completed',
    payload: {
      state: result.state,
      informationGainScore: result.informationGainScore,
      confidence: result.confidence,
      cohortPagesSuccessful: result.cohortPagesSuccessful,
    },
  });
}
