export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditById, getMachineTrustSecurityHistory } = await import('@sitenexis/db');
    const audit = await getAuditById(id, user.id);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });

    const history = await getMachineTrustSecurityHistory(user.id, audit.domain);
    const series = history.map((point) => ({
      date: point.createdAt.toISOString(),
      overallScore: point.overallScore,
      criticalFindings: point.criticalFindings,
      warningFindings: point.warningFindings,
      infoFindings: point.infoFindings,
    }));

    return NextResponse.json({ domain: audit.domain, series });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/machine-trust-security/history failed');
    return NextResponse.json({ error: 'Failed to fetch machine-trust-security history' }, { status: 500 });
  }
}
