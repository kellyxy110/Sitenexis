import type { Ad, AdGeneration } from '../../generated';
import { db } from '../client';

export type { Ad, AdGeneration };

export async function createAd(
  userId: string,
  data: {
    platform?: string;
    mediaType?: string;
    sourceUrl?: string;
    transcript?: string;
    title?: string;
    description?: string;
    niche?: string;
    tags?: string[];
  },
): Promise<Ad> {
  return db.ad.create({
    data: {
      userId,
      platform: (data.platform as Ad['platform']) ?? 'other',
      mediaType: (data.mediaType as Ad['mediaType']) ?? 'text',
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

export async function getAdById(id: string): Promise<Ad | null> {
  return db.ad.findFirst({ where: { id, archivedAt: null } });
}

export async function listAdsByUser(
  userId: string,
  options: { page?: number; pageSize?: number; platform?: string; hookType?: string } = {},
): Promise<{ data: Ad[]; total: number }> {
  const { page = 1, pageSize = 24, platform, hookType } = options;
  const where = {
    userId,
    archivedAt: null,
    ...(platform ? { platform: platform as Ad['platform'] } : {}),
    ...(hookType ? { hookType: hookType as Ad['hookType'] } : {}),
  };
  const [data, total] = await db.$transaction([
    db.ad.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.ad.count({ where }),
  ]);
  return { data, total };
}

export async function saveAdAnalysis(
  id: string,
  analysis: {
    hook?: string;
    hookType?: string;
    emotions?: string[];
    funnelStage?: string;
    ctaType?: string;
    ctaText?: string;
    audience?: string;
    performanceScore?: number;
    hookStrength?: number;
    emotionalIntensity?: number;
    noveltyScore?: number;
    fatigueRisk?: string;
    conversionLikelihood?: string;
    estimatedRunwayDays?: number;
    analysisJson?: object;
  },
): Promise<void> {
  await db.ad.update({
    where: { id },
    data: {
      ...(analysis.hook ? { hook: analysis.hook } : {}),
      ...(analysis.hookType ? { hookType: analysis.hookType as Ad['hookType'] } : {}),
      emotions: analysis.emotions ?? [],
      ...(analysis.funnelStage ? { funnelStage: analysis.funnelStage as Ad['funnelStage'] } : {}),
      ...(analysis.ctaType ? { ctaType: analysis.ctaType as Ad['ctaType'] } : {}),
      ...(analysis.ctaText ? { ctaText: analysis.ctaText } : {}),
      ...(analysis.audience ? { audience: analysis.audience } : {}),
      ...(analysis.performanceScore != null ? { performanceScore: analysis.performanceScore } : {}),
      ...(analysis.hookStrength != null ? { hookStrength: analysis.hookStrength } : {}),
      ...(analysis.emotionalIntensity != null ? { emotionalIntensity: analysis.emotionalIntensity } : {}),
      ...(analysis.noveltyScore != null ? { noveltyScore: analysis.noveltyScore } : {}),
      ...(analysis.fatigueRisk ? { fatigueRisk: analysis.fatigueRisk as Ad['fatigueRisk'] } : {}),
      ...(analysis.conversionLikelihood ? { conversionLikelihood: analysis.conversionLikelihood } : {}),
      ...(analysis.estimatedRunwayDays != null ? { estimatedRunwayDays: analysis.estimatedRunwayDays } : {}),
      ...(analysis.analysisJson ? { analysisJson: analysis.analysisJson } : {}),
      analysisStatus: 'complete',
      analyzedAt: new Date(),
    },
  });
}

export async function softDeleteAd(id: string): Promise<void> {
  await db.ad.update({ where: { id }, data: { archivedAt: new Date() } });
}

export async function createAdGeneration(
  userId: string,
  data: {
    adId?: string;
    inputText: string;
    platforms: string[];
    tone: string;
    localization?: string;
    count: number;
    variations: object;
  },
): Promise<AdGeneration> {
  return db.adGeneration.create({
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

export async function getScoreTrend(
  userId: string,
  days = 30,
): Promise<Array<{ date: string; avgScore: number; count: number }>> {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const ads = await db.ad.findMany({
    where: {
      userId,
      archivedAt: null,
      analysisStatus: 'complete',
      analyzedAt: { gte: since },
    },
    select: { analyzedAt: true, performanceScore: true },
    orderBy: { analyzedAt: 'asc' },
  });

  const byDate = new Map<string, { sum: number; count: number }>();
  for (const ad of ads) {
    if (!ad.analyzedAt || ad.performanceScore == null) continue;
    const date = ad.analyzedAt.toISOString().split('T')[0] as string;
    const existing = byDate.get(date) ?? { sum: 0, count: 0 };
    byDate.set(date, { sum: existing.sum + ad.performanceScore, count: existing.count + 1 });
  }

  return Array.from(byDate.entries()).map(([date, { sum, count }]) => ({
    date,
    avgScore: Math.round(sum / count),
    count,
  }));
}

export async function getAdStats(userId: string): Promise<{
  totalAds: number;
  analyzedAds: number;
  topHookType: string | null;
  avgScore: number;
}> {
  const [total, analyzed, hookAgg, scoreAgg] = await db.$transaction([
    db.ad.count({ where: { userId, archivedAt: null } }),
    db.ad.count({ where: { userId, archivedAt: null, analysisStatus: 'complete' } }),
    db.ad.groupBy({
      by: ['hookType'],
      where: { userId, archivedAt: null, hookType: { not: null } },
      _count: { hookType: true },
      orderBy: { _count: { hookType: 'desc' } },
      take: 1,
    }),
    db.ad.aggregate({
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
