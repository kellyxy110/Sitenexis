import type { Ad, AdGeneration, Prisma } from '../../generated';
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
  options: { page?: number; pageSize?: number; platform?: string; hookType?: string; search?: string } = {},
): Promise<{ data: Ad[]; total: number }> {
  const { page = 1, pageSize = 24, platform, hookType, search } = options;
  const normalizedSearch = search?.trim();
  const where: Prisma.AdWhereInput = {
    userId,
    archivedAt: null,
    ...(platform ? { platform: platform as Ad['platform'] } : {}),
    ...(hookType ? { hookType: hookType as Ad['hookType'] } : {}),
    ...(normalizedSearch ? {
      OR: [
        { transcript: { contains: normalizedSearch, mode: 'insensitive' } },
        { title: { contains: normalizedSearch, mode: 'insensitive' } },
        { description: { contains: normalizedSearch, mode: 'insensitive' } },
        { hook: { contains: normalizedSearch, mode: 'insensitive' } },
        { audience: { contains: normalizedSearch, mode: 'insensitive' } },
        { niche: { contains: normalizedSearch, mode: 'insensitive' } },
        { tags: { has: normalizedSearch.toLowerCase() } },
      ],
    } : {}),
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

export async function setAdAnalysisStatus(
  id: string,
  status: 'pending' | 'running' | 'complete' | 'failed',
): Promise<void> {
  await db.ad.update({
    where: { id },
    data: { analysisStatus: status },
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

export interface CampaignAdComparison {
  id: string;
  platform: string;
  hook: string | null;
  hookType: string | null;
  emotions: string[];
  ctaType: string | null;
  performanceScore: number | null;
  hookStrength: number | null;
  emotionalIntensity: number | null;
  noveltyScore: number | null;
  analysisStatus: string;
  evidenceScore: number | null;
  framework: string | null;
}

export async function compareAdsForCampaign(
  userId: string,
  adIds: string[],
): Promise<{
  ads: CampaignAdComparison[];
  winnerId: string | null;
  recommendation: string;
  limitations: string[];
}> {
  const ads = await db.ad.findMany({
    where: { id: { in: adIds }, userId, archivedAt: null },
    select: {
      id: true,
      platform: true,
      hook: true,
      hookType: true,
      emotions: true,
      ctaType: true,
      performanceScore: true,
      hookStrength: true,
      emotionalIntensity: true,
      noveltyScore: true,
      analysisStatus: true,
      analysisJson: true,
    },
  });

  const comparisons = ads.map((ad) => {
    const json = ad.analysisJson && typeof ad.analysisJson === 'object' && !Array.isArray(ad.analysisJson)
      ? ad.analysisJson as Record<string, unknown>
      : null;
    const structure = json?.['structure'];
    const framework = structure && typeof structure === 'object' && !Array.isArray(structure)
      ? String((structure as Record<string, unknown>)['narrativeArc'] ?? '') || null
      : null;
    const values = [ad.performanceScore, ad.hookStrength, ad.emotionalIntensity, ad.noveltyScore]
      .filter((value): value is number => typeof value === 'number');
    const evidenceScore = values.length === 0 ? null : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
    return { ...ad, evidenceScore, framework };
  });

  const analyzed = comparisons.filter((ad) => ad.analysisStatus === 'complete' && ad.evidenceScore != null);
  const limitations: string[] = [];
  if (ads.length !== adIds.length) limitations.push('Some selected ads were not found or are not owned by this account.');
  if (analyzed.length < comparisons.length) limitations.push('Unanalyzed ads are shown for context but cannot be ranked.');
  if (analyzed.length < 2) limitations.push('At least two completed analyses are required before recommending a campaign winner.');

  if (analyzed.length < 2) {
    return { ads: comparisons, winnerId: null, recommendation: 'Analyze at least two ads to compare campaign strength with evidence.', limitations };
  }

  const winner = [...analyzed].sort((a, b) => (b.evidenceScore ?? 0) - (a.evidenceScore ?? 0))[0]!;
  const strongestHook = winner.hookType ? `${winner.hookType} hook` : 'its current hook';
  const platformNote = winner.platform === 'other' ? '' : ` for ${winner.platform}`;
  return {
    ads: comparisons,
    winnerId: winner.id,
    recommendation: `Prioritize the ad with the ${strongestHook}${platformNote}. Its evidence-backed creative score is ${winner.evidenceScore}/100; use the other ads as controlled alternatives rather than combining untested elements blindly.`,
    limitations,
  };
}
