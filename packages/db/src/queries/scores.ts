import { type AuditScore, type AIVisibilityScore, type PerceptionGraphSnapshot, type Prisma } from '../../generated';
import { db } from '../client';
import { type AuditScores, type PerceptionGraphSnapshot as PGSnapshot } from '@sitenexis/shared';

export type { AuditScore, AIVisibilityScore, PerceptionGraphSnapshot };

export async function saveAuditScores(scores: AuditScores): Promise<AuditScore> {
  const aiVisibilityScore = Math.round(
    (scores.machineReadability?.score ?? 0) * 0.15
    + (scores.entityIntelligence?.entityConfidenceScore ?? 0) * 0.20
    + scores.aiReadability.score * 0.20
    + (scores.citationAnalysis?.citationProbabilityScore ?? 0) * 0.20
    + (scores.semanticTrust?.score ?? 0) * 0.15
    + scores.schema.score * 0.10
  );

  const record = await db.auditScore.upsert({
    where: { auditId: scores.auditId },
    create: {
      auditId: scores.auditId,
      overall: scores.overall,
      seoScore: scores.seo.score,
      aiScore: scores.aiReadability.score,
      schemaScore: scores.schema.score,
      linkGraphScore: scores.linkGraph.score,
      performanceScore: scores.performance.score,
      breakdown: {
        seo: scores.seo.breakdown,
        ai: scores.aiReadability.breakdown,
        machineReadability: scores.machineReadability?.breakdown ?? null,
        entityIntelligence: scores.entityIntelligence ? {
          entityConfidenceScore: scores.entityIntelligence.entityConfidenceScore,
          entityConsistencyScore: scores.entityIntelligence.entityConsistencyScore,
          entityCoverageScore: scores.entityIntelligence.entityCoverageScore,
          disambiguationScore: scores.entityIntelligence.disambiguationScore,
        } : null,
        citationAnalysis: scores.citationAnalysis ? {
          citationProbabilityScore: scores.citationAnalysis.citationProbabilityScore,
        } : null,
        semanticTrust: scores.semanticTrust ? {
          score: scores.semanticTrust.score,
          breakdown: scores.semanticTrust.breakdown,
        } : null,
        schema: {
          coverage: scores.schema.coverage,
          schemaUrls: scores.schema.pageAnalyses
            .filter((p) => p.detectedTypes.length > 0)
            .map((p) => p.url),
        },
        linkGraph: scores.linkGraph as unknown as Prisma.InputJsonObject,
        performance: {
          lcp: scores.performance.lcp,
          fid: scores.performance.fid,
          cls: scores.performance.cls,
          ttfb: scores.performance.ttfb,
        },
      },
    },
    update: {
      overall: scores.overall,
      seoScore: scores.seo.score,
      aiScore: scores.aiReadability.score,
      schemaScore: scores.schema.score,
      linkGraphScore: scores.linkGraph.score,
      performanceScore: scores.performance.score,
    },
  });

  if (scores.machineReadability && scores.entityIntelligence && scores.citationAnalysis && scores.semanticTrust) {
    // Recommendation confidence uses a distinct formula from AI Visibility Score (CLAUDE.md §31)
    const recommendationConfidence = Math.round(
      (scores.entityIntelligence.entityConfidenceScore) * 0.30
      + (scores.citationAnalysis.citationProbabilityScore) * 0.30
      + (scores.semanticTrust.score) * 0.20
      + (scores.machineReadability.score) * 0.10
      + scores.schema.score * 0.10,
    );

    await db.aIVisibilityScore.upsert({
      where: { auditId: scores.auditId },
      create: {
        auditId: scores.auditId,
        aiVisibilityScore,
        machineReadabilityScore: scores.machineReadability.score,
        entityConfidenceScore: scores.entityIntelligence.entityConfidenceScore,
        retrievalReadinessScore: scores.aiReadability.score,
        citationProbabilityScore: scores.citationAnalysis.citationProbabilityScore,
        semanticTrustScore: scores.semanticTrust.score,
        recommendationConfidence,
        providerScores: {},
        breakdown: {
          machineReadability: scores.machineReadability.breakdown,
          entityIntelligence: {
            consistencyScore: scores.entityIntelligence.entityConsistencyScore,
            coverageScore: scores.entityIntelligence.entityCoverageScore,
            disambiguationScore: scores.entityIntelligence.disambiguationScore,
          },
          citationFactors: scores.citationAnalysis.pageAnalyses.slice(0, 3).map((p) => ({
            url: p.url,
            score: p.citationProbability,
          })),
          semanticTrust: scores.semanticTrust.breakdown,
        },
      },
      update: {
        aiVisibilityScore,
        machineReadabilityScore: scores.machineReadability.score,
        entityConfidenceScore: scores.entityIntelligence.entityConfidenceScore,
        retrievalReadinessScore: scores.aiReadability.score,
        citationProbabilityScore: scores.citationAnalysis.citationProbabilityScore,
        semanticTrustScore: scores.semanticTrust.score,
        recommendationConfidence,
      },
    });
  }

  if (scores.perceptionGraph && scores.perceptionGraph.nodes.length > 0) {
    await db.perceptionGraphSnapshot.upsert({
      where: { auditId: scores.auditId },
      create: {
        auditId: scores.auditId,
        nodesJson: scores.perceptionGraph.nodes as unknown as Prisma.JsonArray,
        edgesJson: scores.perceptionGraph.edges as unknown as Prisma.JsonArray,
      },
      update: {
        nodesJson: scores.perceptionGraph.nodes as unknown as Prisma.JsonArray,
        edgesJson: scores.perceptionGraph.edges as unknown as Prisma.JsonArray,
      },
    });
  }

  return record;
}

export async function getAuditScores(auditId: string): Promise<AuditScore | null> {
  return db.auditScore.findUnique({ where: { auditId } });
}

export async function getAIVisibilityScore(auditId: string): Promise<AIVisibilityScore | null> {
  return db.aIVisibilityScore.findUnique({ where: { auditId } });
}

export async function getPerceptionGraph(auditId: string): Promise<PGSnapshot | null> {
  const record = await db.perceptionGraphSnapshot.findUnique({ where: { auditId } });
  if (!record) return null;
  return {
    auditId,
    nodes: record.nodesJson as unknown as PGSnapshot['nodes'],
    edges: record.edgesJson as unknown as PGSnapshot['edges'],
  };
}

export async function getPriorSchemaUrls(auditId: string): Promise<string[]> {
  const record = await db.auditScore.findUnique({ where: { auditId }, select: { breakdown: true } });
  if (!record) return [];
  const bd = record.breakdown as Record<string, unknown> | null;
  const schemaBd = bd?.['schema'] as Record<string, unknown> | undefined;
  return (schemaBd?.['schemaUrls'] as string[] | undefined) ?? [];
}

export async function getEntitiesByAudit(auditId: string) {
  return db.entity.findMany({
    where: { auditId },
    orderBy: { mentionCount: 'desc' },
    include: { relationships: { take: 10 } },
  });
}
