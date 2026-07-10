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
    const { getAuditWithResults, getIGEResult } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await getIGEResult(id);
    const state = resolveGTLState(audit.status, !!result);

    return gtlResponse(state, result);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/information-gain failed');
    return NextResponse.json({ error: 'Failed to load information gain data' }, { status: 500 });
  }
}
