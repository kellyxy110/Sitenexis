"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveRetrievalSimulations = saveRetrievalSimulations;
exports.getRetrievalSimulations = getRetrievalSimulations;
exports.saveMachineTrustScore = saveMachineTrustScore;
exports.getMachineTrustScore = getMachineTrustScore;
exports.saveTemporalAuthorityRecord = saveTemporalAuthorityRecord;
exports.getTemporalAuthorityRecord = getTemporalAuthorityRecord;
exports.saveRecommendationSurfaceMap = saveRecommendationSurfaceMap;
exports.getRecommendationSurfaceMap = getRecommendationSurfaceMap;
exports.saveSyntheticEntityAnalysis = saveSyntheticEntityAnalysis;
exports.getLatestSyntheticEntityAnalysis = getLatestSyntheticEntityAnalysis;
exports.saveSIIScore = saveSIIScore;
exports.getSIIScore = getSIIScore;
const client_1 = require("../client");
// ─── Retrieval Simulation ─────────────────────────────────────────────────────
async function saveRetrievalSimulations(auditId, results) {
    if (results.length === 0)
        return;
    // Upsert each page simulation — keyed by auditId + pageUrl
    await client_1.db.$transaction(results.map((r) => client_1.db.retrievalSimulation.upsert({
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
            retrievalFailures: r.retrievalFailureReasons,
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
            retrievalFailures: r.retrievalFailureReasons,
            truncationZoneWarnings: r.truncationZoneWarnings,
        },
    })));
}
async function getRetrievalSimulations(auditId) {
    const records = await client_1.db.retrievalSimulation.findMany({ where: { auditId } });
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
        retrievalFailureReasons: r.retrievalFailures,
        truncationZoneWarnings: r.truncationZoneWarnings,
    }));
}
// ─── Machine Trust ────────────────────────────────────────────────────────────
async function saveMachineTrustScore(auditId, score) {
    await client_1.db.machineTrustScore.upsert({
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
            trustIssues: score.trustIssues,
            degradationSignals: score.degradationSignals,
        },
        update: {
            overall: score.overall,
            entityCredibilityScore: score.entityCredibilityScore,
            schemaTrustAlignmentScore: score.schemaTrustAlignmentScore,
            externalValidationScore: score.externalValidationScore,
            contradictionAbsenceScore: score.contradictionAbsenceScore,
            trustDegradationResistance: score.trustDegradationResistance,
            crossSourceValidationIndex: score.crossSourceValidationIndex,
            trustIssues: score.trustIssues,
            degradationSignals: score.degradationSignals,
        },
    });
}
async function getMachineTrustScore(auditId) {
    const r = await client_1.db.machineTrustScore.findUnique({ where: { auditId } });
    if (!r)
        return null;
    return {
        overall: r.overall,
        entityCredibilityScore: r.entityCredibilityScore,
        schemaTrustAlignmentScore: r.schemaTrustAlignmentScore,
        externalValidationScore: r.externalValidationScore,
        contradictionAbsenceScore: r.contradictionAbsenceScore,
        trustDegradationResistance: r.trustDegradationResistance,
        crossSourceValidationIndex: r.crossSourceValidationIndex,
        trustIssues: r.trustIssues,
        degradationSignals: r.degradationSignals,
    };
}
// ─── Temporal Authority ───────────────────────────────────────────────────────
async function saveTemporalAuthorityRecord(auditId, result) {
    await client_1.db.temporalAuthorityRecord.upsert({
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
            driftedPages: result.driftedPages,
            temporalIssues: result.temporalIssues,
        },
        update: {
            isBaseline: result.isBaseline,
            authorityVelocityScore: result.authorityVelocityScore,
            trustStabilityIndex: result.trustStabilityIndex,
            contentFreshnessImpactFactor: result.contentFreshnessImpactFactor,
            semanticDriftIndex: result.semanticDriftIndex,
            updateFrequencyClassification: result.updateFrequencyClassification,
            stalePagesAtRisk: result.stalePagesAtRisk,
            driftedPages: result.driftedPages,
            temporalIssues: result.temporalIssues,
        },
    });
}
async function getTemporalAuthorityRecord(auditId) {
    const r = await client_1.db.temporalAuthorityRecord.findUnique({ where: { auditId } });
    if (!r)
        return null;
    return {
        isBaseline: r.isBaseline,
        authorityVelocityScore: r.authorityVelocityScore,
        trustStabilityIndex: r.trustStabilityIndex,
        contentFreshnessImpactFactor: r.contentFreshnessImpactFactor,
        semanticDriftIndex: r.semanticDriftIndex,
        updateFrequencyClassification: r.updateFrequencyClassification,
        stalePagesAtRisk: r.stalePagesAtRisk,
        driftedPages: r.driftedPages,
        temporalIssues: r.temporalIssues,
    };
}
// ─── Recommendation Surface Map ───────────────────────────────────────────────
async function saveRecommendationSurfaceMap(auditId, map) {
    await client_1.db.recommendationSurfaceMap.upsert({
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
            coverageGaps: map.coverageGaps,
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
            coverageGaps: map.coverageGaps,
            missingChannels: map.missingVisibilityChannels,
        },
    });
}
async function getRecommendationSurfaceMap(auditId) {
    const r = await client_1.db.recommendationSurfaceMap.findUnique({ where: { auditId } });
    if (!r)
        return null;
    const makeStatus = (s) => (s === 'visible' || s === 'partial' || s === 'absent') ? s : 'absent';
    return {
        overallSurfaceScore: r.overallSurfaceScore,
        surfaces: {
            aiOverviews: { inclusionProbability: r.aiOverviewsProbability, status: makeStatus(r.aiOverviewsStatus), blockers: [], recommendations: [] },
            chatRecommendation: { inclusionProbability: r.chatProbability, status: makeStatus(r.chatStatus), blockers: [], recommendations: [] },
            voiceRetrieval: { inclusionProbability: r.voiceProbability, status: makeStatus(r.voiceStatus), blockers: [], recommendations: [] },
            agentDiscovery: { inclusionProbability: r.agentProbability, status: makeStatus(r.agentStatus), blockers: [], recommendations: [] },
        },
        coverageGaps: r.coverageGaps,
        missingVisibilityChannels: r.missingChannels,
    };
}
// ─── Synthetic Entity ─────────────────────────────────────────────────────────
async function saveSyntheticEntityAnalysis(auditId, analysis) {
    await client_1.db.syntheticEntityFlag.create({
        data: {
            auditId,
            syntheticRiskScore: analysis.syntheticRiskScore,
            entityAuthenticityConfidence: analysis.entityAuthenticityConfidence,
            networkIntegrityScore: analysis.networkIntegrityScore,
            detectedPatterns: analysis.detectedPatterns,
            flaggedEntities: analysis.flaggedEntities,
            recommendations: analysis.recommendations,
        },
    });
}
async function getLatestSyntheticEntityAnalysis(auditId) {
    const r = await client_1.db.syntheticEntityFlag.findFirst({
        where: { auditId },
        orderBy: { createdAt: 'desc' },
    });
    if (!r)
        return null;
    return {
        syntheticRiskScore: r.syntheticRiskScore,
        entityAuthenticityConfidence: r.entityAuthenticityConfidence,
        networkIntegrityScore: r.networkIntegrityScore,
        detectedPatterns: r.detectedPatterns,
        flaggedEntities: r.flaggedEntities,
        recommendations: r.recommendations,
    };
}
// ─── SiteNexis Intelligence Index ────────────────────────────────────────────
async function saveSIIScore(auditId, result) {
    await client_1.db.sIIScore.upsert({
        where: { auditId },
        update: {
            siiScore: result.sii_score,
            confidence: result.confidence,
            breakdown: result.breakdown,
            weightedContributions: result.weighted_contributions,
            insights: result.insights,
            criticalGaps: result.critical_gaps,
            recommendations: result.recommendation_priority,
        },
        create: {
            auditId,
            siiScore: result.sii_score,
            confidence: result.confidence,
            breakdown: result.breakdown,
            weightedContributions: result.weighted_contributions,
            insights: result.insights,
            criticalGaps: result.critical_gaps,
            recommendations: result.recommendation_priority,
        },
    });
}
async function getSIIScore(auditId) {
    const r = await client_1.db.sIIScore.findUnique({ where: { auditId } });
    if (!r)
        return null;
    return {
        url: '',
        sii_score: r.siiScore,
        confidence: r.confidence,
        breakdown: r.breakdown,
        weighted_contributions: r.weightedContributions,
        insights: r.insights,
        critical_gaps: r.criticalGaps,
        recommendation_priority: r.recommendations,
    };
}
//# sourceMappingURL=v3.js.map