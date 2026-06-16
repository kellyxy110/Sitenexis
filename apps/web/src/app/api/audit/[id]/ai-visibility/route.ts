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
    const { getAuditWithResults, getAIVisibilityScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const score = await getAIVisibilityScore(id);
    const state = resolveGTLState(audit.status, !!score);

    if (!score) return gtlResponse(state, null);

    return gtlResponse(state, {
      auditId: id,
      aiVisibilityScore: score.aiVisibilityScore,
      machineReadabilityScore: score.machineReadabilityScore,
      entityConfidenceScore: score.entityConfidenceScore,
      retrievalReadinessScore: score.retrievalReadinessScore,
      citationProbabilityScore: score.citationProbabilityScore,
      semanticTrustScore: score.semanticTrustScore,
      recommendationConfidence: score.recommendationConfidence,
      providerScores: score.providerScores,
      breakdown: score.breakdown,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/ai-visibility failed');
    return NextResponse.json({ error: 'Failed to load AI visibility data' }, { status: 500 });
  }
}
