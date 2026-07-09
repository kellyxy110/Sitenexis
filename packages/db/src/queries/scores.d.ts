import { type AuditScore, type AIVisibilityScore, type PerceptionGraphSnapshot } from '../../generated';
import { type AuditScores, type PerceptionGraphSnapshot as PGSnapshot } from '@sitenexis/shared';
export type { AuditScore, AIVisibilityScore, PerceptionGraphSnapshot };
export declare function saveAuditScores(scores: AuditScores): Promise<AuditScore>;
export declare function getAuditScores(auditId: string): Promise<AuditScore | null>;
export declare function getAIVisibilityScore(auditId: string): Promise<AIVisibilityScore | null>;
export declare function getPerceptionGraph(auditId: string): Promise<PGSnapshot | null>;
export declare function getPriorSchemaUrls(auditId: string): Promise<string[]>;
export declare function getEntitiesByAudit(auditId: string): Promise<({
    relationships: {
        id: string;
        createdAt: Date;
        auditId: string;
        sourceEntityId: string;
        targetEntityId: string;
        relationshipType: string;
        strength: number;
        evidencedByUrls: string[];
    }[];
} & {
    name: string;
    id: string;
    createdAt: Date;
    type: string;
    description: string | null;
    auditId: string;
    disambiguationScore: number;
    consistencyScore: number;
    normalizedName: string;
    sameAsUrls: string[];
    mentionCount: number;
})[]>;
//# sourceMappingURL=scores.d.ts.map