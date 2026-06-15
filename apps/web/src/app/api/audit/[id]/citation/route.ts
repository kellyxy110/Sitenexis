export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    citationProbabilityScore: 71,
    topCitationCandidates: ['https://example.com/about', 'https://example.com/services', 'https://example.com/pricing'],
    citationBlockers: [
      'Low factual density on homepage — fewer than 5 verifiable specific claims',
      'Missing temporal freshness signals on key pages (no dateModified schema)',
    ],
    recommendations: [
      'Add specific statistics, research references, and dated factual claims to key pages.',
      'Add dateModified schema to updated content.',
      'Increase claim specificity on high-traffic pages.',
    ],
    pageBreakdown: [
      { url: 'https://example.com/', score: 78, topFactor: 'primaryEntityAuthority' },
      { url: 'https://example.com/about', score: 74, topFactor: 'topicalAuthorityDepth' },
      { url: 'https://example.com/services', score: 65, topFactor: 'factualDensity' },
      { url: 'https://example.com/pricing', score: 59, topFactor: 'claimSpecificity' },
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getAIVisibilityScore, getAuditScores } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [visScore, auditScores] = await Promise.all([
      getAIVisibilityScore(id),
      getAuditScores(id),
    ]);

    if (!visScore) return NextResponse.json({ error: 'Citation analysis not yet available' }, { status: 404 });

    const breakdown = (auditScores?.breakdown as Record<string, unknown> | null) ?? {};
    const citBreakdown = breakdown['citationAnalysis'] as Record<string, unknown> | undefined;

    return NextResponse.json({
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
