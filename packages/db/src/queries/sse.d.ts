import type { SseScore } from '../../generated';
export type { SseScore };
export interface SaveSseScoreInput {
    topicalAuthorityScore: number;
    taDepth: number;
    taBreadth: number;
    taInterlinking: number;
    taFreshness: number;
    semanticDensityScore: number;
    sdsRawDensity: number;
    sdsEntityCount: number;
    sdsFactCount: number;
    sdsRelationshipCount: number;
    sdsTotalWords: number;
    aiCrawlabilityScore: number;
    aciRobots: number;
    aciSitemap: number;
    aciRenderability: number;
    aciIndexability: number;
    geoScore: number;
    snsMasterScore: number;
    snsLabel: string;
}
export declare function saveSseScore(auditId: string, data: SaveSseScoreInput): Promise<SseScore>;
export declare function getSseScore(auditId: string): Promise<SseScore | null>;
//# sourceMappingURL=sse.d.ts.map