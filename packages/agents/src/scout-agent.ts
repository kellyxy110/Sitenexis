import { runScoutAnalysis } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';

export interface ScoutAgentInput {
  auditId: string;
  domain: string;
  pages: Array<{
    url: string;
    title: string;
    headings: string[];
    bodyText: string;
    wordCount: number;
    hasSchema: boolean;
    schemaTypes: string[];
  }>;
}

export async function runScoutAgent(input: ScoutAgentInput): Promise<void> {
  const { auditId, domain, pages } = input;

  await emitAgentEvent({ auditId, agentId: 'scout', event: 'started' });

  let result;

  try {
    await emitAgentEvent({
      auditId,
      agentId: 'scout',
      event: 'progress',
      payload: { stage: 'ingestion', pageCount: pages.length },
    });

    result = await runScoutAnalysis({ domain, pages });

    await emitAgentEvent({
      auditId,
      agentId: 'scout',
      event: 'progress',
      payload: {
        stage: 'analysis_complete',
        state: result.state,
        pagesAnalyzed: result.pagesAnalyzed,
        intentCoverageScore: result.intentCoverageScore,
        dominantIntent: result.dominantIntent,
      },
    });
  } catch (engineError: unknown) {
    const msg = engineError instanceof Error ? engineError.message : String(engineError);
    await emitAgentEvent({
      auditId,
      agentId: 'scout',
      event: 'failed',
      errorMessage: `Scout engine error: ${msg}`,
    });
    return;
  }

  try {
    const { saveScoutAnalysis } = await import('@sitenexis/db');
    await saveScoutAnalysis(auditId, domain, result);
  } catch (dbError: unknown) {
    const msg = dbError instanceof Error ? dbError.message : String(dbError);
    await emitAgentEvent({
      auditId,
      agentId: 'scout',
      event: 'failed',
      errorMessage: `Failed to save Scout result to DB: ${msg}`,
    });
    return;
  }

  await emitAgentEvent({
    auditId,
    agentId: 'scout',
    event: 'completed',
    payload: {
      state: result.state,
      pagesAnalyzed: result.pagesAnalyzed,
      intentCoverageScore: result.intentCoverageScore,
      intentAlignmentScore: result.intentAlignmentScore,
      dominantIntent: result.dominantIntent,
    },
  });
}
