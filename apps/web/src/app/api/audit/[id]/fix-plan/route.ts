export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse } from '@/lib/gtl';
import type { AuditStatus, TrustIssue, TemporalIssue, RetrievalFailure, CoverageGap, SyntheticPattern } from '@sitenexis/shared';
import type { SubReportIssues } from '@sitenexis/analyzers';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditWithResults, getIssuesByAudit } = await import('@sitenexis/db');
    const { buildFixPlan } = await import('@sitenexis/analyzers');

    const audit = await getAuditWithResults(id) as {
      userId: string;
      status: AuditStatus;
      domain: string;
    } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const rawIssues = await getIssuesByAudit(id);
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
        const trustResult = await (v3Queries['getMachineTrustScore'] as (id: string) => Promise<unknown>)(id);
        if (trustResult && typeof trustResult === 'object' && 'trustIssues' in trustResult) {
          const arr = (trustResult as Record<string, unknown>).trustIssues;
          if (Array.isArray(arr)) subReportIssues.trustIssues = arr as TrustIssue[];
        }
      }

      if (typeof v3Queries['getTemporalAuthority'] === 'function') {
        const temporalResult = await (v3Queries['getTemporalAuthority'] as (id: string) => Promise<unknown>)(id);
        if (temporalResult && typeof temporalResult === 'object' && 'temporalIssues' in temporalResult) {
          const arr = (temporalResult as Record<string, unknown>).temporalIssues;
          if (Array.isArray(arr)) subReportIssues.temporalIssues = arr as TemporalIssue[];
        }
      }

      if (typeof v3Queries['getRetrievalSimulations'] === 'function') {
        const simResults = await (v3Queries['getRetrievalSimulations'] as (id: string) => Promise<unknown>)(id);
        if (Array.isArray(simResults)) {
          const failures = simResults.flatMap((r: Record<string, unknown>) =>
            Array.isArray(r.retrievalFailureReasons) ? r.retrievalFailureReasons : []
          );
          if (failures.length > 0) subReportIssues.retrievalFailures = failures as RetrievalFailure[];
        }
      }

      if (typeof v3Queries['getRecommendationSurfaceMap'] === 'function') {
        const surfaceResult = await (v3Queries['getRecommendationSurfaceMap'] as (id: string) => Promise<unknown>)(id);
        if (surfaceResult && typeof surfaceResult === 'object' && 'coverageGaps' in surfaceResult) {
          const arr = (surfaceResult as Record<string, unknown>).coverageGaps;
          if (Array.isArray(arr)) subReportIssues.coverageGaps = arr as CoverageGap[];
        }
      }

      if (typeof v3Queries['getSyntheticEntityAnalysis'] === 'function') {
        const syntheticResult = await (v3Queries['getSyntheticEntityAnalysis'] as (id: string) => Promise<unknown>)(id);
        if (syntheticResult && typeof syntheticResult === 'object' && 'detectedPatterns' in syntheticResult) {
          const arr = (syntheticResult as Record<string, unknown>).detectedPatterns;
          if (Array.isArray(arr)) subReportIssues.syntheticPatterns = arr as SyntheticPattern[];
        }
      }
    } catch {
      // Sub-report queries may not exist yet — continue with issues table only
    }

    const fixPlan = buildFixPlan({ domain: audit.domain, issues, subReportIssues });

    return gtlResponse(fixPlan.state, fixPlan);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/fix-plan failed');
    return NextResponse.json({ error: 'Failed to build fix plan' }, { status: 500 });
  }
}
