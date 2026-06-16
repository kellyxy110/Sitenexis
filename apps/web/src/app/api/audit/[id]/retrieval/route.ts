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
    const { getAuditWithResults } = await import('@sitenexis/db');
    const { getRetrievalSimulations } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const results = await getRetrievalSimulations(id);
    const scored = results.filter((r) => r.retrievalQualityScore !== null);
    const state = resolveGTLState(audit.status, results.length > 0);

    if (results.length === 0) return gtlResponse(state, null);

    const avg = scored.length > 0
      ? Math.round(scored.reduce((s, r) => s + (r.retrievalQualityScore ?? 0), 0) / scored.length)
      : null;

    return gtlResponse(state, { auditId: id, avgRetrievalQualityScore: avg, pagesSimulated: scored.length, results });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/retrieval failed');
    return NextResponse.json({ error: 'Failed to load retrieval data' }, { status: 500 });
  }
}
