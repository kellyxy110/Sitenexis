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

  // Auth is the protection here — do NOT gate on isFullyConfigured(). A placeholder
  // env var must not blank out real, persisted SSE scores for an authenticated owner
  // (same failure class fixed for the executive-summary route in b70b926a).
  try {
    const { getAuditWithResults, getSseScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sse = await getSseScore(id);
    const state = resolveGTLState(audit.status as AuditStatus, !!sse);

    if (!sse) return gtlResponse(state, null);

    return gtlResponse(state, {
      auditId: id,
      topicalAuthorityScore: sse.topicalAuthorityScore,
      taBreakdown: { depth: sse.taDepth, breadth: sse.taBreadth, interlinking: sse.taInterlinking, freshness: sse.taFreshness },
      semanticDensityScore: sse.semanticDensityScore,
      sdsRawDensity: sse.sdsRawDensity,
      sdsBreakdown: { entityCount: sse.sdsEntityCount, factCount: sse.sdsFactCount, relationshipCount: sse.sdsRelationshipCount, totalWords: sse.sdsTotalWords },
      aiCrawlabilityScore: sse.aiCrawlabilityScore,
      aciBreakdown: { robots: sse.aciRobots, sitemap: sse.aciSitemap, renderability: sse.aciRenderability, indexability: sse.aciIndexability },
      geoScore: sse.geoScore,
      snsMasterScore: sse.snsMasterScore,
      snsLabel: sse.snsLabel,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/sse failed');
    return NextResponse.json({ error: 'Failed to load SSE scores' }, { status: 500 });
  }
}
