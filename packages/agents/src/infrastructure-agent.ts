import { type CrawledPage } from '@sitenexis/shared';
import { updateAuditStatus, saveAuditScores } from '@sitenexis/db';
import { analyzeLinkGraph, analyzeMachineReadability, buildPerceptionGraph } from '@sitenexis/analyzers';
import { emitAgentEvent } from './registry';
import { runCrawlAgent } from './crawl-agent';
import { runSEOAgent } from './seo-agent';
import { runSchemaAgent } from './schema-agent';
import { runRetrievalAgent } from './retrieval-agent';
import { runEntityAgent } from './entity-agent';
import { runPerformanceAgent } from './performance-agent';
import { runCitationAgent } from './citation-agent';
import { runSemanticTrustAgent } from './semantic-trust-agent';
import { runRetrievalSimulationAgent } from './retrieval-simulation-agent';
import { runMachineTrustAgent } from './machine-trust-agent';
import { runTemporalAuthorityAgent } from './temporal-authority-agent';
import { runRecommendationMappingAgent } from './recommendation-mapping-agent';
import { runSyntheticEntityAgent } from './synthetic-entity-agent';
import { runVisualizationAgent } from './visualization-agent';
import { runReportingAgent } from './reporting-agent';

export interface AuditJobInput {
  auditId: string;
  domain: string;
  userId: string;
  layer4Enabled: boolean;
  maxPages?: number;
}

export async function runInfrastructureAgent(input: AuditJobInput): Promise<void> {
  const { auditId, domain, layer4Enabled, maxPages } = input;

  await updateAuditStatus(auditId, 'running');

  try {
    // Phase 1 — Crawl (sequential)
    const pages: CrawledPage[] = await runCrawlAgent({
      auditId,
      domain,
      ...(maxPages !== undefined ? { maxPages } : {}),
    });

    // Phase 2 — SEO + Schema (parallel)
    const [seo, schema] = await Promise.all([
      runSEOAgent(auditId, pages),
      runSchemaAgent(auditId, pages),
    ]);

    // Phase 3 — Retrieval + Entity + Performance (parallel)
    const [aiReadability, entityIntelligence, performance] = await Promise.all([
      runRetrievalAgent(auditId, pages),
      runEntityAgent(auditId, pages),
      runPerformanceAgent(auditId, pages),
    ]);

    // Phase 4 — Citation + Semantic Trust (parallel, receive entity + schema context)
    const [citationAnalysis, semanticTrust] = await Promise.all([
      runCitationAgent(auditId, pages, entityIntelligence),
      runSemanticTrustAgent(auditId, pages, entityIntelligence, schema),
    ]);

    const linkGraph = analyzeLinkGraph(pages);
    const machineReadability = analyzeMachineReadability(pages);
    const perceptionGraph = buildPerceptionGraph(auditId, pages, entityIntelligence);

    // Phase 5 — Layer 4 agents (parallel, gated by plan)
    if (layer4Enabled) {
      await Promise.all([
        runRetrievalSimulationAgent(auditId, pages),
        runMachineTrustAgent(auditId, pages),
        runTemporalAuthorityAgent(auditId, pages),
        runRecommendationMappingAgent(auditId, pages),
        runSyntheticEntityAgent(auditId, pages),
      ]);
    }

    // Aggregate + save scores (only Infrastructure Agent writes audit.status)
    const overall = Math.round(
      (seo.score
        + aiReadability.score
        + machineReadability.score
        + schema.score
        + linkGraph.score
        + performance.score
        + entityIntelligence.entityConfidenceScore
        + citationAnalysis.citationProbabilityScore
        + semanticTrust.score) / 9
    );

    await saveAuditScores({
      auditId,
      overall,
      seo,
      aiReadability,
      machineReadability,
      schema,
      linkGraph,
      performance,
      entityIntelligence,
      citationAnalysis,
      semanticTrust,
      perceptionGraph,
    });

    // Phase 6 — Visualization (parallel)
    await runVisualizationAgent(auditId);

    // Phase 7 — Reporting (sequential)
    await runReportingAgent(auditId);

    await updateAuditStatus(auditId, 'complete');

    await emitAgentEvent({
      auditId,
      agentId: 'infrastructure',
      event: 'completed',
      payload: { overall },
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    await emitAgentEvent({ auditId, agentId: 'infrastructure', event: 'failed', errorMessage });
    // Partial results are preserved — only status is updated to failed
    await updateAuditStatus(auditId, 'failed');
    throw err;
  }
}
