"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createAd = createAd;
exports.getAdById = getAdById;
exports.listAdsByUser = listAdsByUser;
exports.saveAdAnalysis = saveAdAnalysis;
exports.softDeleteAd = softDeleteAd;
exports.createAdGeneration = createAdGeneration;
exports.getScoreTrend = getScoreTrend;
exports.getAdStats = getAdStats;
const client_1 = require("../client");
async function createAd(userId, data) {
    return client_1.db.ad.create({
        data: {
            userId,
            platform: data.platform ?? 'other',
            mediaType: data.mediaType ?? 'text',
            ...(data.sourceUrl ? { sourceUrl: data.sourceUrl } : {}),
            ...(data.transcript ? { transcript: data.transcript } : {}),
            ...(data.title ? { title: data.title } : {}),
            ...(data.description ? { description: data.description } : {}),
            ...(data.niche ? { niche: data.niche } : {}),
            tags: data.tags ?? [],
            analysisStatus: 'pending',
        },
    });
}
async function getAdById(id) {
    return client_1.db.ad.findFirst({ where: { id, archivedAt: null } });
}
async function listAdsByUser(userId, options = {}) {
    const { page = 1, pageSize = 24, platform, hookType } = options;
    const where = {
        userId,
        archivedAt: null,
        ...(platform ? { platform: platform } : {}),
        ...(hookType ? { hookType: hookType } : {}),
    };
    const [data, total] = await client_1.db.$transaction([
        client_1.db.ad.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
        client_1.db.ad.count({ where }),
    ]);
    return { data, total };
}
async function saveAdAnalysis(id, analysis) {
    await client_1.db.ad.update({
        where: { id },
        data: {
            ...(analysis.hook ? { hook: analysis.hook } : {}),
            ...(analysis.hookType ? { hookType: analysis.hookType } : {}),
            emotions: analysis.emotions ?? [],
            ...(analysis.funnelStage ? { funnelStage: analysis.funnelStage } : {}),
            ...(analysis.ctaType ? { ctaType: analysis.ctaType } : {}),
            ...(analysis.ctaText ? { ctaText: analysis.ctaText } : {}),
            ...(analysis.audience ? { audience: analysis.audience } : {}),
            ...(analysis.performanceScore != null ? { performanceScore: analysis.performanceScore } : {}),
            ...(analysis.hookStrength != null ? { hookStrength: analysis.hookStrength } : {}),
            ...(analysis.emotionalIntensity != null ? { emotionalIntensity: analysis.emotionalIntensity } : {}),
            ...(analysis.noveltyScore != null ? { noveltyScore: analysis.noveltyScore } : {}),
            ...(analysis.fatigueRisk ? { fatigueRisk: analysis.fatigueRisk } : {}),
            ...(analysis.conversionLikelihood ? { conversionLikelihood: analysis.conversionLikelihood } : {}),
            ...(analysis.estimatedRunwayDays != null ? { estimatedRunwayDays: analysis.estimatedRunwayDays } : {}),
            ...(analysis.analysisJson ? { analysisJson: analysis.analysisJson } : {}),
            analysisStatus: 'complete',
            analyzedAt: new Date(),
        },
    });
}
async function softDeleteAd(id) {
    await client_1.db.ad.update({ where: { id }, data: { archivedAt: new Date() } });
}
async function createAdGeneration(userId, data) {
    return client_1.db.adGeneration.create({
        data: {
            userId,
            ...(data.adId ? { adId: data.adId } : {}),
            inputText: data.inputText,
            platforms: data.platforms,
            tone: data.tone,
            ...(data.localization ? { localization: data.localization } : {}),
            count: data.count,
            variations: data.variations,
        },
    });
}
async function getScoreTrend(userId, days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const ads = await client_1.db.ad.findMany({
        where: {
            userId,
            archivedAt: null,
            analysisStatus: 'complete',
            analyzedAt: { gte: since },
        },
        select: { analyzedAt: true, performanceScore: true },
        orderBy: { analyzedAt: 'asc' },
    });
    const byDate = new Map();
    for (const ad of ads) {
        if (!ad.analyzedAt || ad.performanceScore == null)
            continue;
        const date = ad.analyzedAt.toISOString().split('T')[0];
        const existing = byDate.get(date) ?? { sum: 0, count: 0 };
        byDate.set(date, { sum: existing.sum + ad.performanceScore, count: existing.count + 1 });
    }
    return Array.from(byDate.entries()).map(([date, { sum, count }]) => ({
        date,
        avgScore: Math.round(sum / count),
        count,
    }));
}
async function getAdStats(userId) {
    const [total, analyzed, hookAgg, scoreAgg] = await client_1.db.$transaction([
        client_1.db.ad.count({ where: { userId, archivedAt: null } }),
        client_1.db.ad.count({ where: { userId, archivedAt: null, analysisStatus: 'complete' } }),
        client_1.db.ad.groupBy({
            by: ['hookType'],
            where: { userId, archivedAt: null, hookType: { not: null } },
            _count: { hookType: true },
            orderBy: { _count: { hookType: 'desc' } },
            take: 1,
        }),
        client_1.db.ad.aggregate({
            where: { userId, archivedAt: null, performanceScore: { not: null } },
            _avg: { performanceScore: true },
        }),
    ]);
    return {
        totalAds: total,
        analyzedAds: analyzed,
        topHookType: hookAgg[0]?.hookType ?? null,
        avgScore: Math.round(scoreAgg._avg.performanceScore ?? 0),
    };
}
//# sourceMappingURL=ads.js.map