import type { Ad, AdGeneration } from '../../generated';
export type { Ad, AdGeneration };
export declare function createAd(userId: string, data: {
    platform?: string;
    mediaType?: string;
    sourceUrl?: string;
    transcript?: string;
    title?: string;
    description?: string;
    niche?: string;
    tags?: string[];
}): Promise<Ad>;
export declare function getAdById(id: string): Promise<Ad | null>;
export declare function listAdsByUser(userId: string, options?: {
    page?: number;
    pageSize?: number;
    platform?: string;
    hookType?: string;
}): Promise<{
    data: Ad[];
    total: number;
}>;
export declare function saveAdAnalysis(id: string, analysis: {
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
}): Promise<void>;
export declare function softDeleteAd(id: string): Promise<void>;
export declare function createAdGeneration(userId: string, data: {
    adId?: string;
    inputText: string;
    platforms: string[];
    tone: string;
    localization?: string;
    count: number;
    variations: object;
}): Promise<AdGeneration>;
export declare function getScoreTrend(userId: string, days?: number): Promise<Array<{
    date: string;
    avgScore: number;
    count: number;
}>>;
export declare function getAdStats(userId: string): Promise<{
    totalAds: number;
    analyzedAds: number;
    topHookType: string | null;
    avgScore: number;
}>;
//# sourceMappingURL=ads.d.ts.map