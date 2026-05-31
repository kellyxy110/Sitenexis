export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    overall: 76,
    entityCredibilityScore: 82,
    schemaTrustAlignmentScore: 74,
    externalValidationScore: 68,
    contradictionAbsenceScore: 88,
    trustDegradationResistance: 71,
    crossSourceValidationIndex: 0.62,
    trustIssues: [
      { type: 'missing_same_as', severity: 'warning', entity: 'Primary Organisation', description: 'Primary entity has fewer than 3 external sameAs validation links.', recommendation: 'Add sameAs links to Wikidata, LinkedIn, and Companies House.' },
      { type: 'schema_claim_unverified', severity: 'info', entity: 'Service offering', description: '2 schema attributes have no supporting body text evidence.', recommendation: 'Add body text that confirms schema claims for service descriptions.' },
    ],
    degradationSignals: [],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getMachineTrustScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const score = await getMachineTrustScore(id);
    if (!score) return NextResponse.json({ error: 'Machine trust analysis not yet available' }, { status: 404 });

    return NextResponse.json({ auditId: id, ...score });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/machine-trust failed');
    return NextResponse.json({ error: 'Failed to load machine trust data' }, { status: 500 });
  }
}
