export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return gtlEmpty();

  try {
    const { getAuditWithResults, getAIVisibilityScore, getAuditScores } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [visScore, auditScores] = await Promise.all([
      getAIVisibilityScore(id),
      getAuditScores(id),
    ]);

    const state = resolveGTLState(audit.status, !!visScore);
    if (!visScore) return gtlResponse(state, null);

    const breakdown = (auditScores?.breakdown as Record<string, unknown> | null) ?? {};
    const citBreakdown = breakdown['citationAnalysis'] as Record<string, unknown> | undefined;

    return gtlResponse(state, {
      auditId: id,
      citationProbabilityScore: visScore.citationProbabilityScore,
      topCitationCandidates: (citBreakdown?.['topCandidates'] as string[] | undefined) ?? [],
      citationBlockers: (citBreakdown?.['blockers'] as string[] | undefined) ?? [],
      recommendations: (citBreakdown?.['recommendations'] as string[] | undefined) ?? [],
      pageBreakdown: (citBreakdown?.['pageBreakdown'] as unknown[] | undefined) ?? [],
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/citation failed');
    return NextResponse.json({ error: 'Failed to load citation data' }, { status: 500 });
  }
}
