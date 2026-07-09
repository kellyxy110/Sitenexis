"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSelfAuditRun = createSelfAuditRun;
exports.linkSelfAuditToAudit = linkSelfAuditToAudit;
exports.completeSelfAuditRun = completeSelfAuditRun;
exports.failSelfAuditRun = failSelfAuditRun;
exports.saveCrawlRun = saveCrawlRun;
exports.saveVisibilityRun = saveVisibilityRun;
exports.saveEntityRun = saveEntityRun;
exports.saveKnowledgeGraphRun = saveKnowledgeGraphRun;
exports.getLatestSelfAuditRun = getLatestSelfAuditRun;
exports.getSelfAuditRuns = getSelfAuditRuns;
exports.getSelfAuditHistory = getSelfAuditHistory;
exports.getSelfAuditRunById = getSelfAuditRunById;
const client_1 = require("../client");
// ─── Create / Update ──────────────────────────────────────────────────────────
async function createSelfAuditRun(triggeredBy, domain = 'sitenexis.com') {
    const run = await client_1.db.selfAuditRun.create({
        data: { domain, triggeredBy, status: 'running' },
    });
    return run.id;
}
async function linkSelfAuditToAudit(selfAuditRunId, auditId) {
    await client_1.db.selfAuditRun.update({
        where: { id: selfAuditRunId },
        data: { auditId },
    });
}
async function completeSelfAuditRun(selfAuditRunId, scores) {
    await client_1.db.selfAuditRun.update({
        where: { id: selfAuditRunId },
        data: {
            status: 'complete',
            completedAt: new Date(),
            ...scores,
            breakdown: scores.breakdown,
            recommendations: scores.recommendations,
        },
    });
}
async function failSelfAuditRun(selfAuditRunId, errorMessage) {
    await client_1.db.selfAuditRun.update({
        where: { id: selfAuditRunId },
        data: { status: 'failed', completedAt: new Date(), errorMessage },
    });
}
// ─── Child record upserts ─────────────────────────────────────────────────────
async function saveCrawlRun(selfAuditRunId, domain, data) {
    await client_1.db.crawlRun.upsert({
        where: { selfAuditRunId },
        create: {
            selfAuditRunId,
            domain,
            ...data,
            topIssues: data.topIssues,
        },
        update: {
            ...data,
            topIssues: data.topIssues,
        },
    });
}
async function saveVisibilityRun(selfAuditRunId, domain, data) {
    await client_1.db.visibilityRun.upsert({
        where: { selfAuditRunId },
        create: {
            selfAuditRunId,
            domain,
            ...data,
            providerBreakdown: data.providerBreakdown,
        },
        update: {
            ...data,
            providerBreakdown: data.providerBreakdown,
        },
    });
}
async function saveEntityRun(selfAuditRunId, domain, data) {
    await client_1.db.entityRun.upsert({
        where: { selfAuditRunId },
        create: {
            selfAuditRunId,
            domain,
            ...data,
            topEntities: data.topEntities,
        },
        update: {
            ...data,
            topEntities: data.topEntities,
        },
    });
}
async function saveKnowledgeGraphRun(selfAuditRunId, domain, data) {
    await client_1.db.knowledgeGraphRun.upsert({
        where: { selfAuditRunId },
        create: {
            selfAuditRunId,
            domain,
            ...data,
            topNodes: data.topNodes,
        },
        update: {
            ...data,
            topNodes: data.topNodes,
        },
    });
}
// ─── Read queries ─────────────────────────────────────────────────────────────
async function getLatestSelfAuditRun(domain = 'sitenexis.com') {
    const run = await client_1.db.selfAuditRun.findFirst({
        where: { domain, status: 'complete' },
        orderBy: { startedAt: 'desc' },
        include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
    });
    if (!run)
        return null;
    return mapRunRecord(run);
}
async function getSelfAuditRuns(domain = 'sitenexis.com', limit = 50) {
    const runs = await client_1.db.selfAuditRun.findMany({
        where: { domain },
        orderBy: { startedAt: 'desc' },
        take: limit,
        include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
    });
    return runs.map(mapRunRecord);
}
async function getSelfAuditHistory(domain = 'sitenexis.com', windowDays = 30) {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const runs = await client_1.db.selfAuditRun.findMany({
        where: { domain, status: 'complete', startedAt: { gte: since } },
        orderBy: { startedAt: 'asc' },
    });
    return runs.map(mapRunRecord);
}
async function getSelfAuditRunById(id) {
    const run = await client_1.db.selfAuditRun.findUnique({
        where: { id },
        include: { crawlRun: true, visibilityRun: true, entityRun: true, knowledgeGraphRun: true },
    });
    if (!run)
        return null;
    return mapRunRecord(run);
}
// ─── Mapper ───────────────────────────────────────────────────────────────────
function mapRunRecord(run) {
    return {
        id: run.id,
        domain: run.domain,
        triggeredBy: run.triggeredBy,
        status: run.status,
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
        breakdown: run.breakdown,
        recommendations: run.recommendations,
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
            topIssues: run.crawlRun.topIssues,
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
            providerBreakdown: run.visibilityRun.providerBreakdown,
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
            topEntities: run.entityRun.topEntities,
        } : null,
        knowledgeGraphRun: run.knowledgeGraphRun ? {
            nodeCount: run.knowledgeGraphRun.nodeCount,
            edgeCount: run.knowledgeGraphRun.edgeCount,
            topicClusters: run.knowledgeGraphRun.topicClusters,
            avgNodeConfidence: run.knowledgeGraphRun.avgNodeConfidence,
            graphStrengthScore: run.knowledgeGraphRun.graphStrengthScore,
            topNodes: run.knowledgeGraphRun.topNodes,
        } : null,
    };
}
//# sourceMappingURL=self-audit.js.map