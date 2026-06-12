export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    topicalAuthorityScore: 62,
    taBreakdown: { depth: 68, breadth: 58, interlinking: 55, freshness: 40 },
    semanticDensityScore: 54,
    sdsRawDensity: 13.5,
    sdsBreakdown: { entityCount: 24, factCount: 48, relationshipCount: 0, totalWords: 5340 },
    aiCrawlabilityScore: 81,
    aciBreakdown: { robots: 90, sitemap: 80, renderability: 85, indexability: 92 },
    geoScore: 59,
    snsMasterScore: 61,
    snsLabel: 'Strong',
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  try { await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getSseScore } = await import('@sitenexis/db');
    const sse = await getSseScore(id);
    if (!sse) {
      return NextResponse.json(
        { error: 'SSE scores not yet available — run a new audit to generate them' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      auditId: id,
      topicalAuthorityScore: sse.topicalAuthorityScore,
      taBreakdown: {
        depth: sse.taDepth,
        breadth: sse.taBreadth,
        interlinking: sse.taInterlinking,
        freshness: sse.taFreshness,
      },
      semanticDensityScore: sse.semanticDensityScore,
      sdsRawDensity: sse.sdsRawDensity,
      sdsBreakdown: {
        entityCount: sse.sdsEntityCount,
        factCount: sse.sdsFactCount,
        relationshipCount: sse.sdsRelationshipCount,
        totalWords: sse.sdsTotalWords,
      },
      aiCrawlabilityScore: sse.aiCrawlabilityScore,
      aciBreakdown: {
        robots: sse.aciRobots,
        sitemap: sse.aciSitemap,
        renderability: sse.aciRenderability,
        indexability: sse.aciIndexability,
      },
      geoScore: sse.geoScore,
      snsMasterScore: sse.snsMasterScore,
      snsLabel: sse.snsLabel,
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/sse failed');
    return NextResponse.json({ error: 'Failed to load SSE scores' }, { status: 500 });
  }
}
