import { type Issue, type IssueSeverity } from '../../generated';
export type { Issue };
export declare function saveIssues(auditId: string, issues: Array<{
    pageId?: string;
    module: string;
    type: string;
    severity: IssueSeverity;
    message: string;
    recommendation: string;
    problem?: string;
    solution?: string;
    fixCode?: string;
    fixLanguage?: string;
}>): Promise<void>;
export declare function getIssuesByAudit(auditId: string): Promise<Issue[]>;
export declare function getIssuesBySeverity(auditId: string, severity: IssueSeverity): Promise<Issue[]>;
export declare function getIssueById(id: string): Promise<Issue | null>;
export declare function saveFix(issueId: string, fix: {
    problem: string;
    solution: string;
    fixCode: string;
    fixLanguage: string;
}): Promise<void>;
export declare function getIssuesWithFixes(auditId: string): Promise<Issue[]>;
//# sourceMappingURL=issues.d.ts.map