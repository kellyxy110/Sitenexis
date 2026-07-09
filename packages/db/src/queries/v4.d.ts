import type { V4IntelligenceScore, CompetitivePosition, QueryCluster, TrajectoryScenario, DisplacementRecord, UncertaintyDecomposition, ScoreDelta } from '@sitenexis/shared';
export declare function saveV4IntelligenceScore(auditId: string, score: V4IntelligenceScore): Promise<void>;
export declare function getV4IntelligenceScore(auditId: string): Promise<V4IntelligenceScore | null>;
export declare function saveCompetitivePosition(auditId: string, position: CompetitivePosition): Promise<string>;
export declare function getCompetitivePosition(auditId: string): Promise<(CompetitivePosition & {
    queryClusters: QueryCluster[];
}) | null>;
export declare function saveQueryClusters(auditId: string, competitivePositionId: string, clusters: QueryCluster[]): Promise<void>;
export declare function saveTrajectoryScenarios(auditId: string, scenarios: TrajectoryScenario[]): Promise<void>;
export declare function getTrajectoryScenarios(auditId: string): Promise<TrajectoryScenario[]>;
export declare function saveDisplacementRecord(auditId: string, displacement: DisplacementRecord): Promise<void>;
export declare function getDisplacementRecord(auditId: string): Promise<DisplacementRecord | null>;
export declare function saveUncertaintyDecomposition(auditId: string, uncertainty: UncertaintyDecomposition): Promise<void>;
export declare function getUncertaintyDecomposition(auditId: string): Promise<UncertaintyDecomposition | null>;
export declare function computeAndSaveScoreDelta(domain: string, fromAuditId: string, toAuditId: string): Promise<ScoreDelta | null>;
export declare function getScoreHistory(domain: string, limit?: number): Promise<{
    auditId: string;
    score: V4IntelligenceScore;
    createdAt: Date;
}[]>;
export declare function getDomainVelocity(domain: string): Promise<{
    latestDelta: ScoreDelta | null;
    velocityDirection: import('@sitenexis/shared').VelocityDirection;
    trendingDimensions: string[];
}>;
//# sourceMappingURL=v4.d.ts.map