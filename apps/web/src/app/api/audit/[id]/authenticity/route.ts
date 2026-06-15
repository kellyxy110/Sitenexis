export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    syntheticRiskScore: 12,
    entityAuthenticityConfidence: 88,
    networkIntegrityScore: 91,
    detectedPatterns: [
      {
        patternType: 'schema_manipulation',
        confidence: 0.24,
        evidence: ['Review aggregate schema present but no review content detected on page'],
        affectedEntities: [],
        severity: 'info',
      },
    ],
    flaggedEntities: [],
    recommendations: [
      'Add visible review content to pages using aggregate rating schema.',
      'Continue maintaining organic entity citation patterns.',
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getLatestSyntheticEntityAnalysis } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const analysis = await getLatestSyntheticEntityAnalysis(id);
    if (!analysis) return NextResponse.json({ error: 'Authenticity analysis not yet available' }, { status: 404 });

    return NextResponse.json({ auditId: id, ...analysis });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/authenticity failed');
    return NextResponse.json({ error: 'Failed to load authenticity data' }, { status: 500 });
  }
}
