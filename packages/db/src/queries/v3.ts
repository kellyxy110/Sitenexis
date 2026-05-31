import type { Prisma } from '../../generated';
import { db } from '../client';
import type {
  RetrievalSimulationResult,
  MachineTrustScore,
  TemporalAuthorityResult,
  RecommendationSurfaceMap,
  SyntheticEntityAnalysis,
} from '@sitenexis/shared';

// ─── Retrieval Simulation ─────────────────────────────────────────────────────

export async function saveRetrievalSimulations(
  auditId: string,
  results: RetrievalSimulationResult[],
): Promise<void> {
  if (results.length === 0) return;

  // Upsert each page simulation — keyed by auditId + pageUrl
  await db.$transaction(
    results.map((r) =>
      db.retrievalSimulation.upsert({
        where: { id: `${auditId}::${r.pageUrl}` },
        create: {
          id: `${auditId}::${r.pageUrl}`,
          auditId,
          pageUrl: r.pageUrl,
          simulated: r.simulated,
          simulationErrorReason: r.simulationErrorReason ?? null,
          retrievalQualityScore: r.retrievalQualityScore,
          chunkStabilityIndex: r.chunkStabilityIndex,
          answerFormationProbability: r.answerFormationProbability,
          summarisationLossScore: r.summarisationLossScore,
          citationEligibilityScore: r.citationEligibilityScore,
          fragileClaimsCount: r.fragileClaimsCount,
          retrievalFailures: r.retrievalFailureReasons as unknown as Prisma.JsonArray,
          truncationZoneWarnings: r.truncationZoneWarnings,
        },
        update: {
          simulated: r.simulated,
          simulationErrorReason: r.simulationErrorReason ?? null,
          retrievalQualityScore: r.retrievalQualityScore,
          chunkStabilityIndex: r.chunkStabilityIndex,
          answerFormationProbability: r.answerFormationProbability,
          summarisationLossScore: r.summarisationLossScore,
          citationEligibilityScore: r.citationEligibilityScore,
          fragileClaimsCount: r.fragileClaimsCount,
          retrievalFailures: r.retrievalFailureReasons as unknown as Prisma.JsonArray,
          truncationZoneWarnings: r.truncationZoneWarnings,
        },
      }),
    ),
  );
}

export async function getRetrievalSimulations(auditId: string): Promise<RetrievalSimulationResult[]> {
  const records = await db.retrievalSimulation.findMany({ where: { auditId } });
  return records.map((r) => ({
    pageUrl: r.pageUrl,
    simulated: r.simulated,
    ...(r.simulationErrorReason !== null ? { simulationErrorReason: r.simulationErrorReason } : {}),
    retrievalQualityScore: r.retrievalQualityScore,
    chunkStabilityIndex: r.chunkStabilityIndex,
    answerFormationProbability: r.answerFormationProbability,
    summarisationLossScore: r.summarisationLossScore,
    citationEligibilityScore: r.citationEligibilityScore,
    fragileClaimsCount: r.fragileClaimsCount,
    retrievalFailureReasons: r.retrievalFailures as unknown as RetrievalSimulationResult['retrievalFailureReasons'],
    truncationZoneWarnings: r.truncationZoneWarnings,
  }));
}

// ─── Machine Trust ────────────────────────────────────────────────────────────

export async function saveMachineTrustScore(
  auditId: string,
  score: MachineTrustScore,
): Promise<void> {
  await db.machineTrustScore.upsert({
    where: { auditId },
    create: {
      auditId,
      overall: score.overall,
      entityCredibilityScore: score.entityCredibilityScore,
      schemaTrustAlignmentScore: score.schemaTrustAlignmentScore,
      externalValidationScore: score.externalValidationScore,
      contradictionAbsenceScore: score.contradictionAbsenceScore,
      trustDegradationResistance: score.trustDegradationResistance,
      crossSourceValidationIndex: score.crossSourceValidationIndex,
      trustIssues: score.trustIssues as unknown as Prisma.JsonArray,
      degradationSignals: score.degradationSignals as unknown as Prisma.JsonArray,
    },
    update: {
      overall: score.overall,
      entityCredibilityScore: score.entityCredibilityScore,
      schemaTrustAlignmentScore: score.schemaTrustAlignmentScore,
      externalValidationScore: score.externalValidationScore,
      contradictionAbsenceScore: score.contradictionAbsenceScore,
      trustDegradationResistance: score.trustDegradationResistance,
      crossSourceValidationIndex: score.crossSourceValidationIndex,
      trustIssues: score.trustIssues as unknown as Prisma.JsonArray,
      degradationSignals: score.degradationSignals as unknown as Prisma.JsonArray,
    },
  });
}

export async function getMachineTrustScore(auditId: string): Promise<MachineTrustScore | null> {
  const r = await db.machineTrustScore.findUnique({ where: { auditId } });
  if (!r) return null;
  return {
    overall: r.overall,
    entityCredibilityScore: r.entityCredibilityScore,
    schemaTrustAlignmentScore: r.schemaTrustAlignmentScore,
    externalValidationScore: r.externalValidationScore,
    contradictionAbsenceScore: r.contradictionAbsenceScore,
    trustDegradationResistance: r.trustDegradationResistance,
    crossSourceValidationIndex: r.crossSourceValidationIndex,
    trustIssues: r.trustIssues as unknown as MachineTrustScore['trustIssues'],
    degradationSignals: r.degradationSignals as unknown as MachineTrustScore['degradationSignals'],
  };
}

// ─── Temporal Authority ───────────────────────────────────────────────────────

export async function saveTemporalAuthorityRecord(
  auditId: string,
  result: TemporalAuthorityResult,
): Promise<void> {
  await db.temporalAuthorityRecord.upsert({
    where: { auditId },
    create: {
      auditId,
      isBaseline: result.isBaseline,
      authorityVelocityScore: result.authorityVelocityScore,
      trustStabilityIndex: result.trustStabilityIndex,
      contentFreshnessImpactFactor: result.contentFreshnessImpactFactor,
      semanticDriftIndex: result.semanticDriftIndex,
      updateFrequencyClassification: result.updateFrequencyClassification,
      stalePagesAtRisk: result.stalePagesAtRisk,
      driftedPages: result.driftedPages as unknown as Prisma.JsonArray,
      temporalIssues: result.temporalIssues as unknown as Prisma.JsonArray,
    },
    update: {
      isBaseline: result.isBaseline,
      authorityVelocityScore: result.authorityVelocityScore,
      trustStabilityIndex: result.trustStabilityIndex,
      contentFreshnessImpactFactor: result.contentFreshnessImpactFactor,
      semanticDriftIndex: result.semanticDriftIndex,
      updateFrequencyClassification: result.updateFrequencyClassification,
      stalePagesAtRisk: result.stalePagesAtRisk,
      driftedPages: result.driftedPages as unknown as Prisma.JsonArray,
      temporalIssues: result.temporalIssues as unknown as Prisma.JsonArray,
    },
  });
}

export async function getTemporalAuthorityRecord(auditId: string): Promise<TemporalAuthorityResult | null> {
  const r = await db.temporalAuthorityRecord.findUnique({ where: { auditId } });
  if (!r) return null;
  return {
    isBaseline: r.isBaseline,
    authorityVelocityScore: r.authorityVelocityScore,
    trustStabilityIndex: r.trustStabilityIndex,
    contentFreshnessImpactFactor: r.contentFreshnessImpactFactor,
    semanticDriftIndex: r.semanticDriftIndex,
    updateFrequencyClassification: r.updateFrequencyClassification as TemporalAuthorityResult['updateFrequencyClassification'],
    stalePagesAtRisk: r.stalePagesAtRisk,
    driftedPages: r.driftedPages as unknown as TemporalAuthorityResult['driftedPages'],
    temporalIssues: r.temporalIssues as unknown as TemporalAuthorityResult['temporalIssues'],
  };
}

// ─── Recommendation Surface Map ───────────────────────────────────────────────

export async function saveRecommendationSurfaceMap(
  auditId: string,
  map: RecommendationSurfaceMap,
): Promise<void> {
  await db.recommendationSurfaceMap.upsert({
    where: { auditId },
    create: {
      auditId,
      overallSurfaceScore: map.overallSurfaceScore,
      aiOverviewsProbability: map.surfaces.aiOverviews.inclusionProbability,
      aiOverviewsStatus: map.surfaces.aiOverviews.status,
      chatProbability: map.surfaces.chatRecommendation.inclusionProbability,
      chatStatus: map.surfaces.chatRecommendation.status,
      voiceProbability: map.surfaces.voiceRetrieval.inclusionProbability,
      voiceStatus: map.surfaces.voiceRetrieval.status,
      agentProbability: map.surfaces.agentDiscovery.inclusionProbability,
      agentStatus: map.surfaces.agentDiscovery.status,
      coverageGaps: map.coverageGaps as unknown as Prisma.JsonArray,
      missingChannels: map.missingVisibilityChannels,
    },
    update: {
      overallSurfaceScore: map.overallSurfaceScore,
      aiOverviewsProbability: map.surfaces.aiOverviews.inclusionProbability,
      aiOverviewsStatus: map.surfaces.aiOverviews.status,
      chatProbability: map.surfaces.chatRecommendation.inclusionProbability,
      chatStatus: map.surfaces.chatRecommendation.status,
      voiceProbability: map.surfaces.voiceRetrieval.inclusionProbability,
      voiceStatus: map.surfaces.voiceRetrieval.status,
      agentProbability: map.surfaces.agentDiscovery.inclusionProbability,
      agentStatus: map.surfaces.agentDiscovery.status,
      coverageGaps: map.coverageGaps as unknown as Prisma.JsonArray,
      missingChannels: map.missingVisibilityChannels,
    },
  });
}

export async function getRecommendationSurfaceMap(auditId: string): Promise<RecommendationSurfaceMap | null> {
  const r = await db.recommendationSurfaceMap.findUnique({ where: { auditId } });
  if (!r) return null;
  const makeStatus = (s: string): 'visible' | 'partial' | 'absent' =>
    (s === 'visible' || s === 'partial' || s === 'absent') ? s : 'absent';
  return {
    overallSurfaceScore: r.overallSurfaceScore,
    surfaces: {
      aiOverviews: { inclusionProbability: r.aiOverviewsProbability, status: makeStatus(r.aiOverviewsStatus), blockers: [], recommendations: [] },
      chatRecommendation: { inclusionProbability: r.chatProbability, status: makeStatus(r.chatStatus), blockers: [], recommendations: [] },
      voiceRetrieval: { inclusionProbability: r.voiceProbability, status: makeStatus(r.voiceStatus), blockers: [], recommendations: [] },
      agentDiscovery: { inclusionProbability: r.agentProbability, status: makeStatus(r.agentStatus), blockers: [], recommendations: [] },
    },
    coverageGaps: r.coverageGaps as unknown as RecommendationSurfaceMap['coverageGaps'],
    missingVisibilityChannels: r.missingChannels,
  };
}

// ─── Synthetic Entity ─────────────────────────────────────────────────────────

export async function saveSyntheticEntityAnalysis(
  auditId: string,
  analysis: SyntheticEntityAnalysis,
): Promise<void> {
  await db.syntheticEntityFlag.create({
    data: {
      auditId,
      syntheticRiskScore: analysis.syntheticRiskScore,
      entityAuthenticityConfidence: analysis.entityAuthenticityConfidence,
      networkIntegrityScore: analysis.networkIntegrityScore,
      detectedPatterns: analysis.detectedPatterns as unknown as Prisma.JsonArray,
      flaggedEntities: analysis.flaggedEntities as unknown as Prisma.JsonArray,
      recommendations: analysis.recommendations,
    },
  });
}

export async function getLatestSyntheticEntityAnalysis(auditId: string): Promise<SyntheticEntityAnalysis | null> {
  const r = await db.syntheticEntityFlag.findFirst({
    where: { auditId },
    orderBy: { createdAt: 'desc' },
  });
  if (!r) return null;
  return {
    syntheticRiskScore: r.syntheticRiskScore,
    entityAuthenticityConfidence: r.entityAuthenticityConfidence,
    networkIntegrityScore: r.networkIntegrityScore,
    detectedPatterns: r.detectedPatterns as unknown as SyntheticEntityAnalysis['detectedPatterns'],
    flaggedEntities: r.flaggedEntities as unknown as SyntheticEntityAnalysis['flaggedEntities'],
    recommendations: r.recommendations,
  };
}
