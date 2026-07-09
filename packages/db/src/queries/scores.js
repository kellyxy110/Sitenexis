"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAuditScores = saveAuditScores;
exports.getAuditScores = getAuditScores;
exports.getAIVisibilityScore = getAIVisibilityScore;
exports.getPerceptionGraph = getPerceptionGraph;
exports.getPriorSchemaUrls = getPriorSchemaUrls;
exports.getEntitiesByAudit = getEntitiesByAudit;
const client_1 = require("../client");
async function saveAuditScores(scores) {
    const aiVisibilityScore = Math.round((scores.machineReadability?.score ?? 0) * 0.15
        + (scores.entityIntelligence?.entityConfidenceScore ?? 0) * 0.20
        + scores.aiReadability.score * 0.20
        + (scores.citationAnalysis?.citationProbabilityScore ?? 0) * 0.20
        + (scores.semanticTrust?.score ?? 0) * 0.15
        + scores.schema.score * 0.10);
    const record = await client_1.db.auditScore.upsert({
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
                linkGraph: scores.linkGraph,
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
                linkGraph: scores.linkGraph,
                performance: {
                    lcp: scores.performance.lcp,
                    fid: scores.performance.fid,
                    cls: scores.performance.cls,
                    ttfb: scores.performance.ttfb,
                },
            },
        },
    });
    if (scores.machineReadability && scores.entityIntelligence && scores.citationAnalysis && scores.semanticTrust) {
        // Recommendation confidence uses a distinct formula from AI Visibility Score (CLAUDE.md §31)
        const recommendationConfidence = Math.round((scores.entityIntelligence.entityConfidenceScore) * 0.30
            + (scores.citationAnalysis.citationProbabilityScore) * 0.30
            + (scores.semanticTrust.score) * 0.20
            + (scores.machineReadability.score) * 0.10
            + scores.schema.score * 0.10);
        await client_1.db.aIVisibilityScore.upsert({
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
        await client_1.db.perceptionGraphSnapshot.upsert({
            where: { auditId: scores.auditId },
            create: {
                auditId: scores.auditId,
                nodesJson: scores.perceptionGraph.nodes,
                edgesJson: scores.perceptionGraph.edges,
            },
            update: {
                nodesJson: scores.perceptionGraph.nodes,
                edgesJson: scores.perceptionGraph.edges,
            },
        });
    }
    return record;
}
async function getAuditScores(auditId) {
    return client_1.db.auditScore.findUnique({ where: { auditId } });
}
async function getAIVisibilityScore(auditId) {
    return client_1.db.aIVisibilityScore.findUnique({ where: { auditId } });
}
async function getPerceptionGraph(auditId) {
    const record = await client_1.db.perceptionGraphSnapshot.findUnique({ where: { auditId } });
    if (!record)
        return null;
    return {
        auditId,
        nodes: record.nodesJson,
        edges: record.edgesJson,
        perceptionConfidenceScore: record.perceptionConfidenceScore,
    };
}
async function getPriorSchemaUrls(auditId) {
    const record = await client_1.db.auditScore.findUnique({ where: { auditId }, select: { breakdown: true } });
    if (!record)
        return [];
    const bd = record.breakdown;
    const schemaBd = bd?.['schema'];
    return schemaBd?.['schemaUrls'] ?? [];
}
async function getEntitiesByAudit(auditId) {
    return client_1.db.entity.findMany({
        where: { auditId },
        orderBy: { mentionCount: 'desc' },
        include: { relationships: { take: 10 } },
    });
}
//# sourceMappingURL=scores.js.map