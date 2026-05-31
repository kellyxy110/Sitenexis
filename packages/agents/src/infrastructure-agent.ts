import { type CrawledPage } from '@sitenexis/shared';
import {
  updateAuditStatus, saveAuditScores, getAuditScores, getAIVisibilityScore, getPerceptionGraph,
  getPreviousCompletedAuditIdForDomain, getPriorSchemaUrls, saveSIIScore,
} from '@sitenexis/db';
import { analyzeLinkGraph, analyzeMachineReadability, buildPerceptionGraph, computeHealthScore, generateRecommendations, computeSIIScore } from '@sitenexis/analyzers';
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
  selfAuditRunId?: string;
}

export async function runInfrastructureAgent(input: AuditJobInput): Promise<void> {
  const { auditId, domain, layer4Enabled, maxPages, selfAuditRunId } = input;

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
      // Look up prior audit for temporal velocity + schema degradation detection
      const priorAuditId = await getPreviousCompletedAuditIdForDomain(domain, auditId).catch(() => null);
      const priorSchemaUrls = priorAuditId
        ? await getPriorSchemaUrls(priorAuditId).catch(() => [] as string[])
        : [];

      const [retrievalSimulations] = await Promise.all([
        runRetrievalSimulationAgent(auditId, pages, linkGraph.nodes),
        runMachineTrustAgent(auditId, pages, entityIntelligence, schema, priorSchemaUrls.length > 0 ? priorSchemaUrls : undefined),
        runTemporalAuthorityAgent(auditId, pages, entityIntelligence, citationAnalysis, priorAuditId ?? undefined),
        runRecommendationMappingAgent(auditId, pages, {
          retrievalQualityScore: aiReadability.score,
          entityConfidenceScore: entityIntelligence.entityConfidenceScore,
          semanticTrustScore: semanticTrust.score,
          citationProbabilityScore: citationAnalysis.citationProbabilityScore,
          schemaCompletenessScore: schema.score,
          aiExtractabilityScore: aiReadability.score,
          externalValidationScore: Math.round(
            entityIntelligence.entitiesDetected.reduce((s, e) => s + e.sameAsUrls.length, 0) * 15,
          ),
        }, domain),
        runSyntheticEntityAgent(auditId, pages, entityIntelligence),
      ]);
      void retrievalSimulations;
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

    // Compute + persist SII score (synchronous — all inputs already available)
    const siiResult = computeSIIScore({
      url: `https://${domain}`,
      seoScore:                seo.score,
      machineReadabilityScore: machineReadability.score,
      aiVisibilityScore:       null, // derived internally from sub-scores
      semanticTrustScore:      semanticTrust.score,
      entityConfidenceScore:   entityIntelligence.entityConfidenceScore,
      retrievalReadinessScore: aiReadability.score,
      citationProbabilityScore: citationAnalysis.citationProbabilityScore,
      schemaScore:             schema.score,
      pagesCrawled:            pages.length,
    });
    await saveSIIScore(auditId, { ...siiResult, url: `https://${domain}` }).catch(() => {
      // Non-fatal — SII is additive; do not block audit completion
    });

    // Phase 6 — Visualization (parallel)
    await runVisualizationAgent(auditId);

    // Phase 7 — Reporting (sequential)
    await runReportingAgent(auditId);

    await updateAuditStatus(auditId, 'complete');

    // If this is a self-audit run, trigger the post-processor to populate self-audit tables
    if (selfAuditRunId) {
      void populateSelfAuditRunAsync(selfAuditRunId, auditId);
    }

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
    await updateAuditStatus(auditId, 'failed', { errorMessage });
    throw err;
  }
}

// ─── Self-audit post-processor ────────────────────────────────────────────────

async function populateSelfAuditRunAsync(selfAuditRunId: string, auditId: string): Promise<void> {
  try {
    const {
      linkSelfAuditToAudit, completeSelfAuditRun, failSelfAuditRun,
      saveCrawlRun, saveVisibilityRun, saveEntityRun, saveKnowledgeGraphRun,
    } = await import('@sitenexis/db');

    await linkSelfAuditToAudit(selfAuditRunId, auditId);

    const [scores, aiVis, graph] = await Promise.all([
      getAuditScores(auditId),
      getAIVisibilityScore(auditId),
      getPerceptionGraph(auditId),
    ]);

    if (!scores) {
      await failSelfAuditRun(selfAuditRunId, 'Audit scores not found');
      return;
    }

    const bd = (scores.breakdown as Record<string, unknown>) ?? {};
    const seoBd = (bd['seo'] as Record<string, number> | undefined) ?? {};
    const aiBd  = (bd['ai'] as Record<string, number> | undefined) ?? {};
    const mrBd  = (bd['machineReadability'] as Record<string, number> | undefined) ?? {};
    const entBd = (bd['entityIntelligence'] as Record<string, number> | undefined) ?? {};
    const perfBd = (bd['performance'] as Record<string, number | null> | undefined) ?? {};
    const schemaBd = (bd['schema'] as Record<string, number> | undefined) ?? {};

    const seoInput = {
      score: scores.seoScore, issues: [],
      breakdown: {
        titleOptimisation: seoBd['titleOptimisation'] ?? 0,
        metaOptimisation: seoBd['metaOptimisation'] ?? 0,
        headingStructure: seoBd['headingStructure'] ?? 0,
        canonicalisation: seoBd['canonicalisation'] ?? 0,
        crawlability: seoBd['crawlability'] ?? 0,
        imageOptimisation: seoBd['imageOptimisation'] ?? 0,
      },
    };
    const aiInput = {
      score: scores.aiScore, pageScores: [],
      breakdown: {
        entityClarity: aiBd['entityClarity'] ?? scores.aiScore,
        conversationalReadiness: aiBd['conversationalReadiness'] ?? scores.aiScore,
        aiExtractability: aiBd['aiExtractability'] ?? scores.aiScore,
        knowledgeGraphStructure: aiBd['knowledgeGraphStructure'] ?? scores.aiScore,
      },
      missingEntities: [], recommendations: [],
    };
    const mrInput = {
      score: aiVis?.machineReadabilityScore ?? scores.aiScore,
      breakdown: {
        renderingFidelity: mrBd['renderingFidelity'] ?? 75,
        boilerplateRatio: mrBd['boilerplateRatio'] ?? 70,
        chunkBoundaryQuality: mrBd['chunkBoundaryQuality'] ?? 70,
        signalToNoiseRatio: mrBd['signalToNoiseRatio'] ?? 70,
        headingHierarchy: mrBd['headingHierarchy'] ?? 75,
        readingOrderConsistency: mrBd['readingOrderConsistency'] ?? 80,
        linkAnchorQuality: mrBd['linkAnchorQuality'] ?? 70,
      },
      issues: [], pageScores: [],
    };
    const entityInput = {
      entitiesDetected: [], primaryEntity: null,
      entityConsistencyScore: entBd['entityConsistencyScore'] ?? 0,
      entityCoverageScore: entBd['coverageScore'] ?? 0,
      disambiguationScore: entBd['disambiguationScore'] ?? 0,
      entityConfidenceScore: aiVis?.entityConfidenceScore ?? 0,
      inconsistencies: [], missingAttributes: [], recommendations: [],
    };
    const citationInput = {
      citationProbabilityScore: aiVis?.citationProbabilityScore ?? 0,
      pageAnalyses: [], topCitationCandidates: [], citationBlockers: [], recommendations: [],
    };
    const trustInput = {
      score: aiVis?.semanticTrustScore ?? 0,
      breakdown: { authorshipTrust: 0, organisationalTrust: 0, contentTrust: 0, structuralTrust: 0 },
      issues: [], trustSignalsPresent: [], trustSignalsMissing: [],
    };
    const schemaInput = {
      score: scores.schemaScore, issues: [], detectedTypes: [],
      coverage: schemaBd['coverage'] ?? 0, pageAnalyses: [],
    };
    const linkGraphInput = {
      score: scores.linkGraphScore, nodes: [], edges: [], orphanPages: [],
      weakClusters: [], avgPageRank: 0, linkSuggestions: [],
    };
    const perfInput = {
      score: scores.performanceScore,
      lighthouseScore: scores.performanceScore,
      lcp: perfBd['lcp'] ?? null, fid: perfBd['fid'] ?? null,
      cls: perfBd['cls'] ?? null, ttfb: perfBd['ttfb'] ?? null,
      pageResults: [], issues: [],
    };
    const graphInput = graph ?? { auditId, nodes: [], edges: [] };

    const health = computeHealthScore({
      seo: seoInput, aiReadability: aiInput, machineReadability: mrInput,
      entity: entityInput, citation: citationInput, trust: trustInput,
      schema: schemaInput, linkGraph: linkGraphInput, performance: perfInput,
      perceptionGraph: graphInput,
    });

    const recs = generateRecommendations({
      seo: seoInput, aiReadability: aiInput, machineReadability: mrInput,
      entity: entityInput, citation: citationInput, trust: trustInput,
      schema: schemaInput, linkGraph: linkGraphInput, performance: perfInput,
    });

    await completeSelfAuditRun(selfAuditRunId, {
      healthScore: health.overall,
      technicalSeoScore: health.dimensions.technicalSeo,
      aiVisibilityScore: health.dimensions.aiVisibility,
      entityCoverageScore: health.dimensions.entityCoverage,
      citationReadinessScore: health.dimensions.citationReadiness,
      knowledgeGraphScore: health.dimensions.knowledgeGraph,
      trustSignalsScore: health.dimensions.trustSignals,
      performanceScore: health.dimensions.performance,
      geoScore: health.dimensions.geo,
      breakdown: health.breakdown,
      recommendations: recs.map((r) => ({
        dimension: r.dimension, severity: r.severity,
        issue: r.issue, impact: r.impact, fix: r.fix,
        estimatedImprovement: r.estimatedImprovement,
      })),
    });

    await saveCrawlRun(selfAuditRunId, 'sitenexis.com', {
      pagesFound: 0, pagesCrawled: 0, pagesIndexable: 0,
      crawlDurationMs: 0, brokenLinksCount: 0, redirectChainCount: 0,
      missingSitemapPages: 0, crawlHealthScore: scores.seoScore, topIssues: [],
    });
    await saveVisibilityRun(selfAuditRunId, 'sitenexis.com', {
      aiVisibilityScore: aiVis?.aiVisibilityScore ?? 0,
      machineReadabilityScore: mrInput.score,
      retrievalReadinessScore: aiVis?.retrievalReadinessScore ?? 0,
      citationProbability: aiVis?.citationProbabilityScore ?? 0,
      semanticTrustScore: aiVis?.semanticTrustScore ?? 0,
      recommendationConfidence: aiVis?.recommendationConfidence ?? 0,
      retrievalQualityScore: 0, surfaceCoverageScore: 0, providerBreakdown: {},
    });
    await saveEntityRun(selfAuditRunId, 'sitenexis.com', {
      entitiesDetected: 0, primaryEntityName: null,
      entityConfidenceScore: entityInput.entityConfidenceScore,
      entityConsistencyScore: entityInput.entityConsistencyScore,
      entityCoverageScore: entityInput.entityCoverageScore,
      disambiguationScore: entityInput.disambiguationScore,
      sameAsLinksCount: 0, authenticityScore: 100, topEntities: [],
    });
    await saveKnowledgeGraphRun(selfAuditRunId, 'sitenexis.com', {
      nodeCount: graphInput.nodes.length,
      edgeCount: graphInput.edges.length,
      topicClusters: 0,
      avgNodeConfidence: graphInput.nodes.length > 0
        ? graphInput.nodes.reduce((s, n) => s + n.confidence, 0) / graphInput.nodes.length : 0,
      graphStrengthScore: health.dimensions.knowledgeGraph,
      topNodes: graphInput.nodes.slice(0, 10),
    });
  } catch (err) {
    console.error('[infrastructure-agent] self-audit post-processor failed:', err);
    try {
      const { failSelfAuditRun } = await import('@sitenexis/db');
      await failSelfAuditRun(selfAuditRunId, err instanceof Error ? err.message : String(err));
    } catch { /* best-effort */ }
  }
}
