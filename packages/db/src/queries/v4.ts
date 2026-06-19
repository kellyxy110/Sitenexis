import type { Prisma } from '../../generated';
import { db } from '../client';
import type {
  V4IntelligenceScore,
  CompetitivePosition,
  QueryCluster,
  TrajectoryScenario,
  DisplacementRecord,
  UncertaintyDecomposition,
  ScoreDelta,
} from '@sitenexis/shared';

// ─── V4 Intelligence Scores ───────────────────────────────────────────────────

export async function saveV4IntelligenceScore(
  auditId: string,
  score: V4IntelligenceScore,
): Promise<void> {
  await db.v4IntelligenceScore.upsert({
    where: { auditId },
    create: {
      auditId,
      aiVisibilityIndex: score.aiVisibilityIndex,
      citationProbabilityScore: score.citationProbabilityScore,
      semanticClarityScore: score.semanticClarityScore,
      entityAuthorityScore: score.entityAuthorityScore,
      trustCredibilityScore: score.trustCredibilityScore,
      contentDepthScore: score.contentDepthScore,
      competitiveDifferentiationScore: score.competitiveDifferentiationScore,
      retrievalSurfaceOptimizationScore: score.retrievalSurfaceOptimizationScore,
      marketPositionStrength: score.marketPositionStrength,
      compositeIntelligenceScore: score.compositeIntelligenceScore,
      scoreBands: score.scoreBands as unknown as Prisma.InputJsonValue,
      breakdown: score.breakdown as unknown as Prisma.InputJsonValue,
    },
    update: {
      aiVisibilityIndex: score.aiVisibilityIndex,
      citationProbabilityScore: score.citationProbabilityScore,
      semanticClarityScore: score.semanticClarityScore,
      entityAuthorityScore: score.entityAuthorityScore,
      trustCredibilityScore: score.trustCredibilityScore,
      contentDepthScore: score.contentDepthScore,
      competitiveDifferentiationScore: score.competitiveDifferentiationScore,
      retrievalSurfaceOptimizationScore: score.retrievalSurfaceOptimizationScore,
      marketPositionStrength: score.marketPositionStrength,
      compositeIntelligenceScore: score.compositeIntelligenceScore,
      scoreBands: score.scoreBands as unknown as Prisma.InputJsonValue,
      breakdown: score.breakdown as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getV4IntelligenceScore(
  auditId: string,
): Promise<V4IntelligenceScore | null> {
  const row = await db.v4IntelligenceScore.findUnique({ where: { auditId } });
  if (!row) return null;

  return {
    aiVisibilityIndex: row.aiVisibilityIndex,
    citationProbabilityScore: row.citationProbabilityScore,
    semanticClarityScore: row.semanticClarityScore,
    entityAuthorityScore: row.entityAuthorityScore,
    trustCredibilityScore: row.trustCredibilityScore,
    contentDepthScore: row.contentDepthScore,
    competitiveDifferentiationScore: row.competitiveDifferentiationScore,
    retrievalSurfaceOptimizationScore: row.retrievalSurfaceOptimizationScore,
    marketPositionStrength: row.marketPositionStrength,
    compositeIntelligenceScore: row.compositeIntelligenceScore,
    scoreBands: row.scoreBands as Record<string, import('@sitenexis/shared').V4ScoreBand>,
    breakdown: row.breakdown as Record<string, unknown>,
  };
}

// ─── Competitive Position ─────────────────────────────────────────────────────

export async function saveCompetitivePosition(
  auditId: string,
  position: CompetitivePosition,
): Promise<string> {
  const row = await db.competitivePosition.upsert({
    where: { auditId },
    create: {
      auditId,
      primaryCluster: position.primaryCluster,
      citationShareCoreLower: position.citationShareCore.lower,
      citationShareCoreCentral: position.citationShareCore.central,
      citationShareCoreUpper: position.citationShareCore.upper,
      citationShareNicheLower: position.citationShareNiche.lower,
      citationShareNicheCentral: position.citationShareNiche.central,
      citationShareNicheUpper: position.citationShareNiche.upper,
      categoryRankLower: position.categoryRank[0],
      categoryRankUpper: position.categoryRank[1],
      percentileLower: position.positionPercentile.lower,
      percentileCentral: position.positionPercentile.central,
      percentileUpper: position.positionPercentile.upper,
      interpretation: position.interpretation,
      positionStatement: position.positionStatement,
      modelAssumptions: position.modelAssumptions,
    },
    update: {
      primaryCluster: position.primaryCluster,
      citationShareCoreLower: position.citationShareCore.lower,
      citationShareCoreCentral: position.citationShareCore.central,
      citationShareCoreUpper: position.citationShareCore.upper,
      citationShareNicheLower: position.citationShareNiche.lower,
      citationShareNicheCentral: position.citationShareNiche.central,
      citationShareNicheUpper: position.citationShareNiche.upper,
      categoryRankLower: position.categoryRank[0],
      categoryRankUpper: position.categoryRank[1],
      percentileLower: position.positionPercentile.lower,
      percentileCentral: position.positionPercentile.central,
      percentileUpper: position.positionPercentile.upper,
      interpretation: position.interpretation,
      positionStatement: position.positionStatement,
      modelAssumptions: position.modelAssumptions,
    },
  });
  return row.id;
}

export async function getCompetitivePosition(
  auditId: string,
): Promise<(CompetitivePosition & { queryClusters: QueryCluster[] }) | null> {
  const row = await db.competitivePosition.findUnique({
    where: { auditId },
    include: { queryClusters: true },
  });
  if (!row) return null;

  const clusters: QueryCluster[] = row.queryClusters.map((c) => ({
    clusterId: c.clusterId,
    label: c.label,
    intentType: c.intentType as import('@sitenexis/shared').QueryClusterIntentType,
    estimatedDensity: c.estimatedDensity as import('@sitenexis/shared').QueryClusterDensity,
    citationBudget: [c.citationBudgetLower, c.citationBudgetUpper],
    marketGrowthRate: c.marketGrowthRate as import('@sitenexis/shared').MarketGrowthRate,
    zeroSumDegree: c.zeroSumDegree,
    domainCurrentShare: { lower: c.shareLower, central: c.shareCentral, upper: c.shareUpper },
    domainCurrentPercentile: { lower: c.percentileLower, central: c.percentileCentral, upper: c.percentileUpper },
    exposureLevel: c.exposureLevel as 'low' | 'medium' | 'high' | 'dominant',
    exposureTrend: c.exposureTrend as 'declining' | 'flat' | 'rising',
  }));

  const assumptions = row.modelAssumptions as CompetitivePosition['modelAssumptions'];

  return {
    primaryCluster: row.primaryCluster,
    citationShareCore: { lower: row.citationShareCoreLower, central: row.citationShareCoreCentral, upper: row.citationShareCoreUpper },
    citationShareNiche: { lower: row.citationShareNicheLower, central: row.citationShareNicheCentral, upper: row.citationShareNicheUpper },
    categoryRank: [row.categoryRankLower, row.categoryRankUpper],
    positionPercentile: { lower: row.percentileLower, central: row.percentileCentral, upper: row.percentileUpper },
    interpretation: row.interpretation as import('@sitenexis/shared').PositionInterpretation,
    positionStatement: row.positionStatement,
    simulationModelVersion: row.simulationModelVersion,
    modelAssumptions: assumptions,
    queryClusters: clusters,
  };
}

// ─── Query Clusters ───────────────────────────────────────────────────────────

export async function saveQueryClusters(
  auditId: string,
  competitivePositionId: string,
  clusters: QueryCluster[],
): Promise<void> {
  // Delete existing clusters for this position before replacing
  await db.queryCluster.deleteMany({ where: { competitivePositionId } });

  if (clusters.length === 0) return;

  await db.queryCluster.createMany({
    data: clusters.map((c) => ({
      auditId,
      competitivePositionId,
      clusterId: c.clusterId,
      label: c.label,
      intentType: c.intentType,
      estimatedDensity: c.estimatedDensity,
      citationBudgetLower: c.citationBudget[0],
      citationBudgetUpper: c.citationBudget[1],
      marketGrowthRate: c.marketGrowthRate,
      zeroSumDegree: c.zeroSumDegree,
      shareLower: c.domainCurrentShare.lower,
      shareCentral: c.domainCurrentShare.central,
      shareUpper: c.domainCurrentShare.upper,
      percentileLower: c.domainCurrentPercentile.lower,
      percentileCentral: c.domainCurrentPercentile.central,
      percentileUpper: c.domainCurrentPercentile.upper,
      exposureLevel: c.exposureLevel,
      exposureTrend: c.exposureTrend,
    })),
  });
}

// ─── Trajectory Scenarios ─────────────────────────────────────────────────────

export async function saveTrajectoryScenarios(
  auditId: string,
  scenarios: TrajectoryScenario[],
): Promise<void> {
  await db.trajectoryScenario.deleteMany({ where: { auditId } });
  if (scenarios.length === 0) return;

  await db.trajectoryScenario.createMany({
    data: scenarios.map((s) => ({
      auditId,
      scenarioName: s.scenarioName,
      competitorAssumption: s.competitorAssumption,
      timeHorizonDays: s.timeHorizonDays,
      projectedShareLower: s.projectedShare.lower,
      projectedShareCentral: s.projectedShare.central,
      projectedShareUpper: s.projectedShare.upper,
      projectedPercentileLower: s.projectedPercentile.lower,
      projectedPercentileCentral: s.projectedPercentile.central,
      projectedPercentileUpper: s.projectedPercentile.upper,
      primaryDriver: s.primaryDriver,
    })),
  });
}

export async function getTrajectoryScenarios(
  auditId: string,
): Promise<TrajectoryScenario[]> {
  const rows = await db.trajectoryScenario.findMany({
    where: { auditId },
    orderBy: [{ timeHorizonDays: 'asc' }, { scenarioName: 'asc' }],
  });

  return rows.map((r) => ({
    scenarioName: r.scenarioName as import('@sitenexis/shared').ScenarioName,
    competitorAssumption: r.competitorAssumption as import('@sitenexis/shared').CompetitorAssumption,
    timeHorizonDays: r.timeHorizonDays as 30 | 90 | 365,
    projectedShare: { lower: r.projectedShareLower, central: r.projectedShareCentral, upper: r.projectedShareUpper },
    projectedPercentile: { lower: r.projectedPercentileLower, central: r.projectedPercentileCentral, upper: r.projectedPercentileUpper },
    primaryDriver: r.primaryDriver,
  }));
}

// ─── Displacement Record ──────────────────────────────────────────────────────

export async function saveDisplacementRecord(
  auditId: string,
  displacement: DisplacementRecord,
): Promise<void> {
  await db.displacementRecord.upsert({
    where: { auditId },
    create: {
      auditId,
      atRisk: displacement.atRisk,
      dominantMechanism: displacement.dominantMechanism,
      competitorImprovementPct: displacement.competitorImprovementPct,
      trustDecayPct: displacement.trustDecayPct,
      marketSaturationPct: displacement.marketSaturationPct,
      reversibleByOwnAction: displacement.reversibleByOwnAction,
      urgencyLevel: displacement.urgencyLevel,
      statement: displacement.statement,
      mechanismsJson: displacement.mechanisms as unknown as Prisma.InputJsonValue,
    },
    update: {
      atRisk: displacement.atRisk,
      dominantMechanism: displacement.dominantMechanism,
      competitorImprovementPct: displacement.competitorImprovementPct,
      trustDecayPct: displacement.trustDecayPct,
      marketSaturationPct: displacement.marketSaturationPct,
      reversibleByOwnAction: displacement.reversibleByOwnAction,
      urgencyLevel: displacement.urgencyLevel,
      statement: displacement.statement,
      mechanismsJson: displacement.mechanisms as unknown as Prisma.InputJsonValue,
    },
  });
}

export async function getDisplacementRecord(
  auditId: string,
): Promise<DisplacementRecord | null> {
  const row = await db.displacementRecord.findUnique({ where: { auditId } });
  if (!row) return null;

  return {
    atRisk: row.atRisk,
    dominantMechanism: row.dominantMechanism as import('@sitenexis/shared').DisplacementMechanism,
    competitorImprovementPct: row.competitorImprovementPct,
    trustDecayPct: row.trustDecayPct,
    marketSaturationPct: row.marketSaturationPct,
    reversibleByOwnAction: row.reversibleByOwnAction,
    urgencyLevel: row.urgencyLevel as import('@sitenexis/shared').UrgencyLevel,
    statement: row.statement,
    mechanisms: row.mechanismsJson as unknown as import('@sitenexis/shared').DisplacementMechanismDetail[],
  };
}

// ─── Uncertainty Decomposition ────────────────────────────────────────────────

export async function saveUncertaintyDecomposition(
  auditId: string,
  uncertainty: UncertaintyDecomposition,
): Promise<void> {
  await db.uncertaintyDecomposition.upsert({
    where: { auditId },
    create: {
      auditId,
      overallIntervalLower: uncertainty.overallInterval[0],
      overallIntervalUpper: uncertainty.overallInterval[1],
      intervalWidth: uncertainty.intervalWidth,
      dominantSource: uncertainty.dominantSource,
      howToNarrow: uncertainty.howToNarrow,
      sourcesJson: uncertainty.sources as unknown as Prisma.InputJsonValue,
      reducibleSources: uncertainty.reducibleSources,
      irreducibleSources: uncertainty.irreducibleSources,
    },
    update: {
      overallIntervalLower: uncertainty.overallInterval[0],
      overallIntervalUpper: uncertainty.overallInterval[1],
      intervalWidth: uncertainty.intervalWidth,
      dominantSource: uncertainty.dominantSource,
      howToNarrow: uncertainty.howToNarrow,
      sourcesJson: uncertainty.sources as unknown as Prisma.InputJsonValue,
      reducibleSources: uncertainty.reducibleSources,
      irreducibleSources: uncertainty.irreducibleSources,
    },
  });
}

export async function getUncertaintyDecomposition(
  auditId: string,
): Promise<UncertaintyDecomposition | null> {
  const row = await db.uncertaintyDecomposition.findUnique({ where: { auditId } });
  if (!row) return null;

  return {
    overallInterval: [row.overallIntervalLower, row.overallIntervalUpper],
    intervalWidth: row.intervalWidth as import('@sitenexis/shared').IntervalWidth,
    dominantSource: row.dominantSource,
    howToNarrow: row.howToNarrow,
    sources: row.sourcesJson as unknown as import('@sitenexis/shared').UncertaintySource[],
    reducibleSources: row.reducibleSources,
    irreducibleSources: row.irreducibleSources,
  };
}

// ─── Score Deltas (Temporal Intelligence) ────────────────────────────────────

export async function computeAndSaveScoreDelta(
  domain: string,
  fromAuditId: string,
  toAuditId: string,
): Promise<ScoreDelta | null> {
  const [from, to] = await Promise.all([
    db.v4IntelligenceScore.findUnique({ where: { auditId: fromAuditId } }),
    db.v4IntelligenceScore.findUnique({ where: { auditId: toAuditId } }),
  ]);

  if (!from || !to) return null;

  const delta = {
    deltaAiVisibilityIndex: to.aiVisibilityIndex - from.aiVisibilityIndex,
    deltaCitationProbability: to.citationProbabilityScore - from.citationProbabilityScore,
    deltaSemanticClarity: to.semanticClarityScore - from.semanticClarityScore,
    deltaEntityAuthority: to.entityAuthorityScore - from.entityAuthorityScore,
    deltaTrustCredibility: to.trustCredibilityScore - from.trustCredibilityScore,
    deltaContentDepth: to.contentDepthScore - from.contentDepthScore,
    deltaCompetitiveDifferentiation: to.competitiveDifferentiationScore - from.competitiveDifferentiationScore,
    deltaRetrievalSurfaceOptimization: to.retrievalSurfaceOptimizationScore - from.retrievalSurfaceOptimizationScore,
    deltaMarketPositionStrength: to.marketPositionStrength - from.marketPositionStrength,
    deltaCompositeScore: to.compositeIntelligenceScore - from.compositeIntelligenceScore,
  };

  const positiveDeltas = Object.values(delta).filter((d) => d > 0.5).length;
  const negativeDeltas = Object.values(delta).filter((d) => d < -0.5).length;

  const velocityDirection =
    positiveDeltas > negativeDeltas ? 'improving'
    : negativeDeltas > positiveDeltas ? 'declining'
    : 'stable';

  // Identify the dimension with the largest absolute change as primary driver
  const dimensionMap: Record<string, number> = {
    'AI Visibility Index': Math.abs(delta.deltaAiVisibilityIndex),
    'Citation Probability': Math.abs(delta.deltaCitationProbability),
    'Entity Authority': Math.abs(delta.deltaEntityAuthority),
    'Market Position': Math.abs(delta.deltaMarketPositionStrength),
    'Trust & Credibility': Math.abs(delta.deltaTrustCredibility),
    'Semantic Clarity': Math.abs(delta.deltaSemanticClarity),
    'Retrieval Surface': Math.abs(delta.deltaRetrievalSurfaceOptimization),
    'Competitive Differentiation': Math.abs(delta.deltaCompetitiveDifferentiation),
    'Content Depth': Math.abs(delta.deltaContentDepth),
  };

  const primaryVelocityDriver = Object.entries(dimensionMap)
    .sort(([, a], [, b]) => b - a)[0]?.[0] ?? '';

  await db.scoreDelta.upsert({
    where: { fromAuditId_toAuditId: { fromAuditId, toAuditId } },
    create: {
      domain, fromAuditId, toAuditId, ...delta,
      velocityDirection, primaryVelocityDriver,
      allDeltasJson: delta,
    },
    update: {
      ...delta, velocityDirection, primaryVelocityDriver, allDeltasJson: delta,
    },
  });

  return {
    domain, fromAuditId, toAuditId, ...delta,
    velocityDirection: velocityDirection as import('@sitenexis/shared').VelocityDirection,
    primaryVelocityDriver,
    computedAt: new Date(),
  };
}

export async function getScoreHistory(
  domain: string,
  limit = 12,
): Promise<{ auditId: string; score: V4IntelligenceScore; createdAt: Date }[]> {
  const audits = await db.audit.findMany({
    where: { domain, status: 'complete', archivedAt: null },
    orderBy: { completedAt: 'desc' },
    take: limit,
    select: { id: true, completedAt: true, v4IntelligenceScore: true },
  });

  return audits
    .filter((a) => a.v4IntelligenceScore !== null)
    .map((a) => ({
      auditId: a.id,
      createdAt: a.completedAt ?? new Date(),
      score: {
        aiVisibilityIndex: a.v4IntelligenceScore!.aiVisibilityIndex,
        citationProbabilityScore: a.v4IntelligenceScore!.citationProbabilityScore,
        semanticClarityScore: a.v4IntelligenceScore!.semanticClarityScore,
        entityAuthorityScore: a.v4IntelligenceScore!.entityAuthorityScore,
        trustCredibilityScore: a.v4IntelligenceScore!.trustCredibilityScore,
        contentDepthScore: a.v4IntelligenceScore!.contentDepthScore,
        competitiveDifferentiationScore: a.v4IntelligenceScore!.competitiveDifferentiationScore,
        retrievalSurfaceOptimizationScore: a.v4IntelligenceScore!.retrievalSurfaceOptimizationScore,
        marketPositionStrength: a.v4IntelligenceScore!.marketPositionStrength,
        compositeIntelligenceScore: a.v4IntelligenceScore!.compositeIntelligenceScore,
        scoreBands: a.v4IntelligenceScore!.scoreBands as Record<string, import('@sitenexis/shared').V4ScoreBand>,
        breakdown: a.v4IntelligenceScore!.breakdown as Record<string, unknown>,
      },
    }));
}

export async function getDomainVelocity(domain: string): Promise<{
  latestDelta: ScoreDelta | null;
  velocityDirection: import('@sitenexis/shared').VelocityDirection;
  trendingDimensions: string[];
}> {
  const latestRow = await db.scoreDelta.findFirst({
    where: { domain },
    orderBy: { computedAt: 'desc' },
  });

  if (!latestRow) {
    return { latestDelta: null, velocityDirection: 'stable', trendingDimensions: [] };
  }

  const allDeltas = latestRow.allDeltasJson as Record<string, number>;
  const trendingDimensions = Object.entries(allDeltas)
    .filter(([, v]) => Math.abs(v) > 2)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 3)
    .map(([k]) => k);

  return {
    latestDelta: {
      domain: latestRow.domain,
      fromAuditId: latestRow.fromAuditId,
      toAuditId: latestRow.toAuditId,
      deltaAiVisibilityIndex: latestRow.deltaAiVisibilityIndex,
      deltaCitationProbability: latestRow.deltaCitationProbability,
      deltaSemanticClarity: latestRow.deltaSemanticClarity,
      deltaEntityAuthority: latestRow.deltaEntityAuthority,
      deltaTrustCredibility: latestRow.deltaTrustCredibility,
      deltaContentDepth: latestRow.deltaContentDepth,
      deltaCompetitiveDifferentiation: latestRow.deltaCompetitiveDifferentiation,
      deltaRetrievalSurfaceOptimization: latestRow.deltaRetrievalSurfaceOptimization,
      deltaMarketPositionStrength: latestRow.deltaMarketPositionStrength,
      deltaCompositeScore: latestRow.deltaCompositeScore,
      velocityDirection: latestRow.velocityDirection as import('@sitenexis/shared').VelocityDirection,
      primaryVelocityDriver: latestRow.primaryVelocityDriver,
      computedAt: latestRow.computedAt,
    },
    velocityDirection: latestRow.velocityDirection as import('@sitenexis/shared').VelocityDirection,
    trendingDimensions,
  };
}
