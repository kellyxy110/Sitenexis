export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditWithResults, getSIIScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus; domain: string } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sii = await getSIIScore(id);
    const state = resolveGTLState(audit.status, !!sii);

    return gtlResponse(state, sii ? { auditId: id, ...sii, url: `https://${audit.domain}` } : null);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/sii failed');
    return NextResponse.json({ error: 'Failed to load SII score' }, { status: 500 });
  }
}
