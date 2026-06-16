export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return gtlEmpty();

  try {
    const { getAuditWithResults, getSseScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();

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
