import type { RetrievalSimulationResult, MachineTrustScore, TemporalAuthorityResult, RecommendationSurfaceMap, SyntheticEntityAnalysis, SIIScore } from '@sitenexis/shared';
export declare function saveRetrievalSimulations(auditId: string, results: RetrievalSimulationResult[]): Promise<void>;
export declare function getRetrievalSimulations(auditId: string): Promise<RetrievalSimulationResult[]>;
export declare function saveMachineTrustScore(auditId: string, score: MachineTrustScore): Promise<void>;
export declare function getMachineTrustScore(auditId: string): Promise<MachineTrustScore | null>;
export declare function saveTemporalAuthorityRecord(auditId: string, result: TemporalAuthorityResult): Promise<void>;
export declare function getTemporalAuthorityRecord(auditId: string): Promise<TemporalAuthorityResult | null>;
export declare function saveRecommendationSurfaceMap(auditId: string, map: RecommendationSurfaceMap): Promise<void>;
export declare function getRecommendationSurfaceMap(auditId: string): Promise<RecommendationSurfaceMap | null>;
export declare function saveSyntheticEntityAnalysis(auditId: string, analysis: SyntheticEntityAnalysis): Promise<void>;
export declare function getLatestSyntheticEntityAnalysis(auditId: string): Promise<SyntheticEntityAnalysis | null>;
export declare function saveSIIScore(auditId: string, result: SIIScore): Promise<void>;
export declare function getSIIScore(auditId: string): Promise<SIIScore | null>;
//# sourceMappingURL=v3.d.ts.map