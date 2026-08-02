export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

export interface ActionPlanPageEvidence {
  issueId: string;
  pageUrl: string | null;
  message: string;
  title: string | null;
  h1: string | null;
  wordCount: number | null;
}

export interface ActionPlanCard {
  id: string;
  module: string;
  type: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  recommendation: string;
  problem: string | null;
  solution: string | null;
  confidence: 'high' | 'low';
  renderMethod: string | null;
  affectedPageCount: number;
  affectedUrls: string[];
  mergedModules: string[];
  pages: ActionPlanPageEvidence[];
}

// GET /api/audit/[id]/action-plan
// Deduplicated, page-attributed issue list for the Action Plan tab. Uses the
// same canonical dedupe module as Fix Plan/Roadmap, the PDF, Executive
// Summary, and Narrative Report — one grouped card per real-world fix, with
// every affected page preserved (never hidden) inside `pages`.
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditById, getIssuesByAudit, getPagesByAudit } = await import('@sitenexis/db');
    const { dedupeFindings } = await import('@sitenexis/analyzers');

    const audit = await getAuditById(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [rawIssues, pages] = await Promise.all([
      getIssuesByAudit(id),
      getPagesByAudit(id).catch(() => []),
    ]);

    const pageById = new Map(pages.map((p) => [p.id, p]));

    const dedupeInput = rawIssues.map((issue) => ({
      id: issue.id,
      module: issue.module,
      type: issue.type,
      severity: issue.severity as 'critical' | 'warning' | 'info',
      message: issue.message,
      recommendation: issue.recommendation,
      problem: issue.problem,
      solution: issue.solution,
      pageUrl: issue.pageUrl,
      pageId: issue.pageId,
      fixCode: issue.fixCode,
      confidence: (issue.confidence as 'high' | 'low' | null) ?? 'high',
      renderMethod: issue.renderMethod,
    }));

    const groups = dedupeFindings(dedupeInput);

    const severityOrder: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const cards: ActionPlanCard[] = groups
      .sort((a, b) => (severityOrder[a.representative.severity] ?? 2) - (severityOrder[b.representative.severity] ?? 2))
      .map((group) => {
        const rep = group.representative;
        return {
          id: rep.id,
          module: rep.module,
          type: rep.type,
          severity: rep.severity,
          message: rep.message,
          recommendation: rep.recommendation,
          problem: rep.problem,
          solution: rep.solution,
          confidence: rep.confidence,
          renderMethod: rep.renderMethod,
          affectedPageCount: group.affectedPageCount,
          affectedUrls: group.affectedUrls,
          mergedModules: group.mergedModules,
          pages: group.members.map((m) => {
            const page = m.pageId ? pageById.get(m.pageId) : undefined;
            return {
              issueId: m.id,
              pageUrl: m.pageUrl ?? null,
              message: m.message,
              title: page?.title ?? null,
              h1: page?.h1 ?? null,
              wordCount: page?.wordCount ?? null,
            };
          }),
        };
      });

    const state = resolveGTLState(audit.status, cards.length > 0);
    return gtlResponse(state, { cards, totalRawIssues: rawIssues.length });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/action-plan failed');
    return NextResponse.json({ error: 'Failed to build action plan' }, { status: 500 });
  }
}
