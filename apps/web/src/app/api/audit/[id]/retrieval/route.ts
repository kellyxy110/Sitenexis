export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoRetrievalData(auditId: string) {
  return {
    auditId,
    avgRetrievalQualityScore: 71,
    pagesSimulated: 12,
    results: [
      { pageUrl: 'https://example.com/', simulated: true, retrievalQualityScore: 78, chunkStabilityIndex: 0.82, answerFormationProbability: 0.74, summarisationLossScore: 81, citationEligibilityScore: 72, fragileClaimsCount: 2, retrievalFailureReasons: [], truncationZoneWarnings: [] },
      { pageUrl: 'https://example.com/about', simulated: true, retrievalQualityScore: 65, chunkStabilityIndex: 0.71, answerFormationProbability: 0.61, summarisationLossScore: 70, citationEligibilityScore: 58, fragileClaimsCount: 4, retrievalFailureReasons: [{ stage: 'summarisation', description: '4 fragile claims detected', severity: 'warning', affectedChunks: [], recommendation: 'Replace cross-chunk dependencies with self-contained statements.' }], truncationZoneWarnings: [] },
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoRetrievalData(id));

  try {
    const { getAuditWithResults } = await import('@sitenexis/db');
    const { getRetrievalSimulations } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const results = await getRetrievalSimulations(id);
    const scored = results.filter((r) => r.retrievalQualityScore !== null);
    const avg = scored.length > 0
      ? Math.round(scored.reduce((s, r) => s + (r.retrievalQualityScore ?? 0), 0) / scored.length)
      : null;

    return NextResponse.json({ auditId: id, avgRetrievalQualityScore: avg, pagesSimulated: scored.length, results });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/retrieval failed');
    return NextResponse.json({ error: 'Failed to load retrieval data' }, { status: 500 });
  }
}
