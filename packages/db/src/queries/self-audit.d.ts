export type SelfAuditRunStatus = 'running' | 'complete' | 'failed';
export type SelfAuditTrigger = 'deploy' | 'cron' | 'manual';
export interface SelfAuditRunRecord {
    id: string;
    domain: string;
    triggeredBy: SelfAuditTrigger;
    status: SelfAuditRunStatus;
    auditId: string | null;
    healthScore: number | null;
    technicalSeoScore: number | null;
    aiVisibilityScore: number | null;
    entityCoverageScore: number | null;
    citationReadinessScore: number | null;
    knowledgeGraphScore: number | null;
    trustSignalsScore: number | null;
    performanceScore: number | null;
    geoScore: number | null;
    breakdown: Record<string, unknown> | null;
    recommendations: SelfAuditRecommendation[] | null;
    startedAt: Date;
    completedAt: Date | null;
    errorMessage: string | null;
    crawlRun?: CrawlRunRecord | null;
    visibilityRun?: VisibilityRunRecord | null;
    entityRun?: EntityRunRecord | null;
    knowledgeGraphRun?: KnowledgeGraphRunRecord | null;
}
export interface CrawlRunRecord {
    pagesFound: number;
    pagesCrawled: number;
    pagesIndexable: number;
    crawlDurationMs: number;
    brokenLinksCount: number;
    redirectChainCount: number;
    missingSitemapPages: number;
    crawlHealthScore: number;
    topIssues: unknown[];
}
export interface VisibilityRunRecord {
    aiVisibilityScore: number;
    machineReadabilityScore: number;
    retrievalReadinessScore: number;
    citationProbability: number;
    semanticTrustScore: number;
    recommendationConfidence: number;
    retrievalQualityScore: number;
    surfaceCoverageScore: number;
    providerBreakdown: Record<string, unknown>;
}
export interface EntityRunRecord {
    entitiesDetected: number;
    primaryEntityName: string | null;
    entityConfidenceScore: number;
    entityConsistencyScore: number;
    entityCoverageScore: number;
    disambiguationScore: number;
    sameAsLinksCount: number;
    authenticityScore: number;
    topEntities: unknown[];
}
export interface KnowledgeGraphRunRecord {
    nodeCount: number;
    edgeCount: number;
    topicClusters: number;
    avgNodeConfidence: number;
    graphStrengthScore: number;
    topNodes: unknown[];
}
export interface SelfAuditRecommendation {
    dimension: string;
    severity: 'critical' | 'warning' | 'info';
    issue: string;
    impact: string;
    fix: string;
    estimatedImprovement: number;
}
export declare function createSelfAuditRun(triggeredBy: SelfAuditTrigger, domain?: string): Promise<string>;
export declare function linkSelfAuditToAudit(selfAuditRunId: string, auditId: string): Promise<void>;
export declare function completeSelfAuditRun(selfAuditRunId: string, scores: {
    healthScore: number;
    technicalSeoScore: number;
    aiVisibilityScore: number;
    entityCoverageScore: number;
    citationReadinessScore: number;
    knowledgeGraphScore: number;
    trustSignalsScore: number;
    performanceScore: number;
    geoScore: number;
    breakdown: Record<string, unknown>;
    recommendations: SelfAuditRecommendation[];
}): Promise<void>;
export declare function failSelfAuditRun(selfAuditRunId: string, errorMessage: string): Promise<void>;
export declare function saveCrawlRun(selfAuditRunId: string, domain: string, data: CrawlRunRecord): Promise<void>;
export declare function saveVisibilityRun(selfAuditRunId: string, domain: string, data: VisibilityRunRecord): Promise<void>;
export declare function saveEntityRun(selfAuditRunId: string, domain: string, data: EntityRunRecord): Promise<void>;
export declare function saveKnowledgeGraphRun(selfAuditRunId: string, domain: string, data: KnowledgeGraphRunRecord): Promise<void>;
export declare function getLatestSelfAuditRun(domain?: string): Promise<SelfAuditRunRecord | null>;
export declare function getSelfAuditRuns(domain?: string, limit?: number): Promise<SelfAuditRunRecord[]>;
export declare function getSelfAuditHistory(domain?: string, windowDays?: 7 | 30 | 90): Promise<SelfAuditRunRecord[]>;
export declare function getSelfAuditRunById(id: string): Promise<SelfAuditRunRecord | null>;
//# sourceMappingURL=self-audit.d.ts.map