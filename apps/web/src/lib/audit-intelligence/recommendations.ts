import type { TrustIssue, TemporalIssue, RetrievalFailure, CoverageGap, SyntheticPattern, FixPlan } from '@sitenexis/shared';
import type { SubReportIssues } from '@sitenexis/analyzers';

/**
 * Builds the same canonical `FixPlan` that `/api/audit/[id]/fix-plan` and
 * the Roadmap tab use — `buildFixPlan` is a pure function; no scoring or
 * priority logic is reimplemented here. Used by Telegram's /recommendations
 * command.
 */
export async function getAuditFixPlan(auditId: string): Promise<FixPlan | null> {
  const { getAuditById, getIssuesByAudit } = await import('@sitenexis/db');
  const { buildFixPlan } = await import('@sitenexis/analyzers');

  const audit = await getAuditById(auditId);
  if (!audit) return null;

  const rawIssues = await getIssuesByAudit(auditId);
  const issues = rawIssues.map((issue) => ({
    id: issue.id,
    module: issue.module,
    type: issue.type,
    severity: issue.severity as 'critical' | 'warning' | 'info',
    message: issue.message,
    recommendation: issue.recommendation,
    pageUrl: issue.pageUrl,
    problem: issue.problem,
    solution: issue.solution,
    fixCode: issue.fixCode,
    fixLanguage: issue.fixLanguage,
  }));

  const subReportIssues: SubReportIssues = {};

  try {
    const v3Queries = await import('@sitenexis/db') as unknown as Record<string, unknown>;

    if (typeof v3Queries['getMachineTrustScore'] === 'function') {
      const trustResult = await (v3Queries['getMachineTrustScore'] as (id: string) => Promise<unknown>)(auditId);
      if (trustResult && typeof trustResult === 'object' && 'trustIssues' in trustResult) {
        const arr = (trustResult as Record<string, unknown>).trustIssues;
        if (Array.isArray(arr)) subReportIssues.trustIssues = arr as TrustIssue[];
      }
    }

    if (typeof v3Queries['getTemporalAuthority'] === 'function') {
      const temporalResult = await (v3Queries['getTemporalAuthority'] as (id: string) => Promise<unknown>)(auditId);
      if (temporalResult && typeof temporalResult === 'object' && 'temporalIssues' in temporalResult) {
        const arr = (temporalResult as Record<string, unknown>).temporalIssues;
        if (Array.isArray(arr)) subReportIssues.temporalIssues = arr as TemporalIssue[];
      }
    }

    if (typeof v3Queries['getRetrievalSimulations'] === 'function') {
      const simResults = await (v3Queries['getRetrievalSimulations'] as (id: string) => Promise<unknown>)(auditId);
      if (Array.isArray(simResults)) {
        const failures = simResults.flatMap((r: Record<string, unknown>) =>
          Array.isArray(r.retrievalFailureReasons) ? r.retrievalFailureReasons : []
        );
        if (failures.length > 0) subReportIssues.retrievalFailures = failures as RetrievalFailure[];
      }
    }

    if (typeof v3Queries['getRecommendationSurfaceMap'] === 'function') {
      const surfaceResult = await (v3Queries['getRecommendationSurfaceMap'] as (id: string) => Promise<unknown>)(auditId);
      if (surfaceResult && typeof surfaceResult === 'object' && 'coverageGaps' in surfaceResult) {
        const arr = (surfaceResult as Record<string, unknown>).coverageGaps;
        if (Array.isArray(arr)) subReportIssues.coverageGaps = arr as CoverageGap[];
      }
    }

    if (typeof v3Queries['getSyntheticEntityAnalysis'] === 'function') {
      const syntheticResult = await (v3Queries['getSyntheticEntityAnalysis'] as (id: string) => Promise<unknown>)(auditId);
      if (syntheticResult && typeof syntheticResult === 'object' && 'detectedPatterns' in syntheticResult) {
        const arr = (syntheticResult as Record<string, unknown>).detectedPatterns;
        if (Array.isArray(arr)) subReportIssues.syntheticPatterns = arr as SyntheticPattern[];
      }
    }
  } catch {
    // Sub-report queries may not exist yet — continue with issues table only
  }

  return buildFixPlan({ domain: audit.domain, issues, subReportIssues });
}
