export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    isBaseline: true,
    authorityVelocityScore: null,
    trustStabilityIndex: 0.84,
    contentFreshnessImpactFactor: 0.76,
    semanticDriftIndex: 0,
    updateFrequencyClassification: 'periodic',
    stalePagesAtRisk: [],
    driftedPages: [],
    temporalIssues: [
      { type: 'low_freshness', severity: 'warning', pageUrl: '/blog', description: 'Several blog posts contain time-sensitive statistics that are over 12 months old.', recommendation: 'Refresh statistics and add dateModified schema to updated pages.' },
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getTemporalAuthorityRecord } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const record = await getTemporalAuthorityRecord(id);
    if (!record) return NextResponse.json({ error: 'Temporal authority analysis not yet available' }, { status: 404 });

    return NextResponse.json({ auditId: id, ...record });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/temporal failed');
    return NextResponse.json({ error: 'Failed to load temporal authority data' }, { status: 500 });
  }
}
