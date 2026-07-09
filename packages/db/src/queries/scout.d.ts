import type { ScoutAnalysisResult } from '@sitenexis/shared';
export declare function saveScoutAnalysis(auditId: string, domain: string, result: ScoutAnalysisResult): Promise<void>;
export declare function getScoutAnalysis(auditId: string): Promise<ScoutAnalysisResult | null>;
//# sourceMappingURL=scout.d.ts.map