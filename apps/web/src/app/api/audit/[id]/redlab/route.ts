export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditById, getRedLabReport } = await import('@sitenexis/db');
    const audit = await getAuditById(id, user.id);
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const report = await getRedLabReport(id);
    const state = resolveGTLState(audit.status, report !== null);
    return gtlResponse(state, report);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/redlab failed');
    return NextResponse.json({ error: 'Failed to fetch RedLab report' }, { status: 500 });
  }
}
