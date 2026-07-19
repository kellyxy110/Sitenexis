import { db } from '../client';
import type { Prisma } from '../../generated';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SelfAuditRunStatus = 'running' | 'complete' | 'failed';
export type SelfAuditTrigger = 'deploy' | 'cron' | 'manual';

export interface SelfAuditRunRecord {
  id: string;
  domain: string;
  triggeredBy: SelfAuditTrigger;
  status: SelfAuditRunStatus;
  auditId: string | null;
  healthScore: number | null;
  technicalSeoScore: number | null;
  aiVisibilityScore: number | null;
  entityCoverageScore: number | null;
  citationReadinessScore: number | null;
  knowledgeGraphScore: number | null;
  trustSignalsScore: number | null;
  performanceScore: number | null;
  geoScore: number | null;
  breakdown: Record<string, unknown> | null;
  recommendations: SelfAuditRecommendation[] | null;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  crawlRun?: CrawlRunRecord | null;
  visibilityRun?: VisibilityRunRecord | null;
  entityRun?: EntityRunRecord | null;
  knowledgeGraphRun?: KnowledgeGraphRunRecord | null;
}

export interface CrawlRunRecord {
  pagesFound: number;
  pagesCrawled: number;
  pagesIndexable: number;
  crawlDurationMs: number;
  brokenLinksCount: number;
  redirectChainCount: number;
  missingSitemapPages: number;
  crawlHealthScore: number;
  topIssues: unknown[];
}

export interface VisibilityRunRecord {
  aiVisibilityScore: number;
  machineReadabilityScore: number;
  retrievalReadinessScore: number;
  citationProbability: number;
  semanticTrustScore: number;
  recommendationConfidence: number;
  retrievalQualityScore: number;
  surfaceCoverageScore: number;
  providerBreakdown: Record<string, unknown>;
}

export interface EntityRunRecord {
  entitiesDetected: number;
  primaryEntityName: string | null;
  entityConfidenceScore: number;
  entityConsistencyScore: number;
  entityCoverageScore: number;
  disambiguationScore: number;
  sameAsLinksCount: number;
  authenticityScore: number;
  topEntities: unknown[];
}

export interface KnowledgeGraphRunRecord {
  nodeCount: number;
  edgeCount: number;
  topicClusters: number;
  avgNodeConfidence: number;
  graphStrengthScore: number;
  topNodes: unknown[];
}

export interface SelfAuditRecommendation {
  dimension: string;
  severity: 'critical' | 'warning' | 'info';
  issue: string;
  impact: string;
  fix: string;
  estimatedImprovement: number;
}

// ─── Create / Update ──────────────────────────────────────────────────────────

export async function createSelfAuditRun(
  triggeredBy: SelfAuditTrigger,
  domain = 'sitenexis.vercel.app',
): Promise<string> {
  const run = await db.selfAuditRun.create({
    data: { domain, triggeredBy, status: 'running' },
  });
  return run.id;
}

export async function linkSelfAuditToAudit(
  selfAuditRunId: string,
  auditId: string,
): Promise<void> {
  await db.selfAuditRun.update({
    where: { id: selfAuditRunId },
    data: { auditId },
  });
}

export async function completeSelfAuditRun(
  selfAuditRunId: string,
  scores: {
    healthScore: number;
    technicalSeoScore: number;
    aiVisibilityScore: number;
    entityCoverageScore: number;
    citationReadinessScore: number;
    knowledgeGraphScore: number;
    trustSignalsScore: number;
    performanceScore: number;
    geoScore: number;
    breakdown: Record<string, unknown>;
    recommendations: SelfAuditRecommendation[];
  },
): Promise<void> {
  await db.selfAuditRun.update({
    where: { id: selfAuditRunId },
    data: {
      status: 'complete',
      completedAt: new Date(),
      ...scores,
      breakdown: scores.breakdown as Prisma.InputJsonValue,
      recommendations: scores.recommendations as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function failSelfAuditRun(
  selfAuditRunId: string,
  errorMessage: string,
): Promise<void> {
  await db.selfAuditRun.update({
    where: { id: selfAuditRunId },
    data: { status: 'failed', completedAt: new Date(), errorMessage },
  });
}

// ─── Child record upserts ─────────────────────────────────────────────────────

export async function saveCrawlRun(
  selfAuditRunId: string,
  domain: string,
  data: CrawlRunRecord,
): Promise<void> {
  await db.crawlRun.upsert({
    where: { selfAuditRunId },
    create: {
      selfAuditRunId,
      domain,
      ...data,
      topIssues: data.topIssues as Prisma.InputJsonValue,
    },
    update: {
      ...data,
      topIssues: data.topIssues as Prisma.InputJsonValue,
    },
  });
}

export async function saveVisibilityRun(
  selfAuditRunId: string,
  domain: string,
  data: VisibilityRunRecord,
): Promise<void> {
  await db.visibilityRun.upsert({
    where: { selfAuditRunId },
    create: {
      selfAuditRunId,
      domain,
      ...data,
      providerBreakdown: data.providerBreakdown as Prisma.InputJsonValue,
    },
    update: {
      ...data,
      providerBreakdown: data.providerBreakdown as Prisma.InputJsonValue,
    },
  });
}

export async function saveEntityRun(
  selfAuditRunId: string,
  domain: string,
  data: EntityRunRecord,
): Promise<void> {
  await db.entityRun.upsert({
    where: { selfAuditRunId },
    create: {
      selfAuditRunId,
      domain,
      ...data,
      topEntities: data.topEntities as Prisma.InputJsonValue,
    },
    update: {
      ...data,
      topEntities: data.topEntities as Prisma.InputJsonValue,
    },
  });
}

export async function saveKnowledgeGraphRun(
  selfAuditRunId: string,
  domain: string,
  data: KnowledgeGraphRunRecord,
): Promise<void> {
  await db.knowledgeGraphRun.upsert({
    where: { selfAuditRunId },
    create: {
      selfAuditRunId,
      domain,
      ...data,
      topNodes: data.topNodes as Prisma.InputJsonValue,
    },
    update: {
      ...data,
      topNodes: data.topNodes as Prisma.InputJsonValue,
    },
  });
}

// ─── Read queries ─────────────────────────────────────────────────────────────

export async function getLatestSelfAuditRun(
  domain = 'sitenexis.vercel.app',
): Promise<SelfAuditRunRecord | null> {
  const run = await db.selfAuditRun.findFirst({
    where: { domain, status: 'complete' },
    orderBy: { startedAt: 'desc' },
    include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
  });
  if (!run) return null;
  return mapRunRecord(run);
}

export async function getSelfAuditRuns(
  domain = 'sitenexis.vercel.app',
  limit = 50,
): Promise<SelfAuditRunRecord[]> {
  const runs = await db.selfAuditRun.findMany({
    where: { domain },
    orderBy: { startedAt: 'desc' },
    take: limit,
    include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
  });
  return runs.map(mapRunRecord);
}

export async function getSelfAuditHistory(
  domain = 'sitenexis.vercel.app',
  windowDays: 7 | 30 | 90 = 30,
): Promise<SelfAuditRunRecord[]> {
  const since = new Date(Date.now() - windowDays * 86_400_000);
  const runs = await db.selfAuditRun.findMany({
    where: { domain, status: 'complete', startedAt: { gte: since } },
    orderBy: { startedAt: 'asc' },
  });
  return runs.map(mapRunRecord);
}

export async function getSelfAuditRunById(id: string): Promise<SelfAuditRunRecord | null> {
  const run = await db.selfAuditRun.findUnique({
    where: { id },
    include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
  });
  if (!run) return null;
  return mapRunRecord(run);
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapRunRecord(run: {
  id: string;
  domain: string;
  triggeredBy: string;
  status: string;
  auditId: string | null;
  healthScore: number | null;
  technicalSeoScore: number | null;
  aiVisibilityScore: number | null;
  entityCoverageScore: number | null;
  citationReadinessScore: number | null;
  knowledgeGraphScore: number | null;
  trustSignalsScore: number | null;
  performanceScore: number | null;
  geoScore: number | null;
  breakdown: Prisma.JsonValue | null;
  recommendations: Prisma.JsonValue | null;
  startedAt: Date;
  completedAt: Date | null;
  errorMessage: string | null;
  crawlRun?: {
    pagesFound: number; pagesCrawled: number; pagesIndexable: number;
    crawlDurationMs: number; brokenLinksCount: number; redirectChainCount: number;
    missingSitemapPages: number; crawlHealthScore: number; topIssues: Prisma.JsonValue;
  } | null;
  visibilityRun?: {
    aiVisibilityScore: number; machineReadabilityScore: number;
    retrievalReadinessScore: number; citationProbability: number;
    semanticTrustScore: number; recommendationConfidence: number;
    retrievalQualityScore: number; surfaceCoverageScore: number;
    providerBreakdown: Prisma.JsonValue;
  } | null;
  entityRun?: {
    entitiesDetected: number; primaryEntityName: string | null;
    entityConfidenceScore: number; entityConsistencyScore: number;
    entityCoverageScore: number; disambiguationScore: number;
    sameAsLinksCount: number; authenticityScore: number; topEntities: Prisma.JsonValue;
  } | null;
  knowledgeGraphRun?: {
    nodeCount: number; edgeCount: number; topicClusters: number;
    avgNodeConfidence: number; graphStrengthScore: number; topNodes: Prisma.JsonValue;
  } | null;
}): SelfAuditRunRecord {
  return {
    id: run.id,
    domain: run.domain,
    triggeredBy: run.triggeredBy as SelfAuditTrigger,
    status: run.status as SelfAuditRunStatus,
    auditId: run.auditId,
    healthScore: run.healthScore,
    technicalSeoScore: run.technicalSeoScore,
    aiVisibilityScore: run.aiVisibilityScore,
    entityCoverageScore: run.entityCoverageScore,
    citationReadinessScore: run.citationReadinessScore,
    knowledgeGraphScore: run.knowledgeGraphScore,
    trustSignalsScore: run.trustSignalsScore,
    performanceScore: run.performanceScore,
    geoScore: run.geoScore,
    breakdown: run.breakdown as Record<string, unknown> | null,
    recommendations: run.recommendations as SelfAuditRecommendation[] | null,
    startedAt: run.startedAt,
    completedAt: run.completedAt,
    errorMessage: run.errorMessage,
    crawlRun: run.crawlRun ? {
      pagesFound: run.crawlRun.pagesFound,
      pagesCrawled: run.crawlRun.pagesCrawled,
      pagesIndexable: run.crawlRun.pagesIndexable,
      crawlDurationMs: run.crawlRun.crawlDurationMs,
      brokenLinksCount: run.crawlRun.brokenLinksCount,
      redirectChainCount: run.crawlRun.redirectChainCount,
      missingSitemapPages: run.crawlRun.missingSitemapPages,
      crawlHealthScore: run.crawlRun.crawlHealthScore,
      topIssues: run.crawlRun.topIssues as unknown[],
    } : null,
    visibilityRun: run.visibilityRun ? {
      aiVisibilityScore: run.visibilityRun.aiVisibilityScore,
      machineReadabilityScore: run.visibilityRun.machineReadabilityScore,
      retrievalReadinessScore: run.visibilityRun.retrievalReadinessScore,
      citationProbability: run.visibilityRun.citationProbability,
      semanticTrustScore: run.visibilityRun.semanticTrustScore,
      recommendationConfidence: run.visibilityRun.recommendationConfidence,
      retrievalQualityScore: run.visibilityRun.retrievalQualityScore,
      surfaceCoverageScore: run.visibilityRun.surfaceCoverageScore,
      providerBreakdown: run.visibilityRun.providerBreakdown as Record<string, unknown>,
    } : null,
    entityRun: run.entityRun ? {
      entitiesDetected: run.entityRun.entitiesDetected,
      primaryEntityName: run.entityRun.primaryEntityName,
      entityConfidenceScore: run.entityRun.entityConfidenceScore,
      entityConsistencyScore: run.entityRun.entityConsistencyScore,
      entityCoverageScore: run.entityRun.entityCoverageScore,
      disambiguationScore: run.entityRun.disambiguationScore,
      sameAsLinksCount: run.entityRun.sameAsLinksCount,
      authenticityScore: run.entityRun.authenticityScore,
      topEntities: run.entityRun.topEntities as unknown[],
    } : null,
    knowledgeGraphRun: run.knowledgeGraphRun ? {
      nodeCount: run.knowledgeGraphRun.nodeCount,
      edgeCount: run.knowledgeGraphRun.edgeCount,
      topicClusters: run.knowledgeGraphRun.topicClusters,
      avgNodeConfidence: run.knowledgeGraphRun.avgNodeConfidence,
      graphStrengthScore: run.knowledgeGraphRun.graphStrengthScore,
      topNodes: run.knowledgeGraphRun.topNodes as unknown[],
    } : null,
  };
}
