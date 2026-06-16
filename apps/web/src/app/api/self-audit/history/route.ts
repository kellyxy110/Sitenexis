export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger';

const QuerySchema = z.object({
  window: z.enum(['7', '30', '90']).default('30'),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const params = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = QuerySchema.safeParse(params);
  const window = parsed.success ? (parseInt(parsed.data.window, 10) as 7 | 30 | 90) : 30;

  try {
    const { getSelfAuditHistory } = await import('@sitenexis/db');
    const runs = await getSelfAuditHistory('sitenexis.com', window);

    const series = runs.map((r) => ({
      date: r.startedAt.toISOString(),
      healthScore: r.healthScore,
      technicalSeoScore: r.technicalSeoScore,
      aiVisibilityScore: r.aiVisibilityScore,
      entityCoverageScore: r.entityCoverageScore,
      citationReadinessScore: r.citationReadinessScore,
      knowledgeGraphScore: r.knowledgeGraphScore,
      trustSignalsScore: r.trustSignalsScore,
      performanceScore: r.performanceScore,
      geoScore: r.geoScore,
    }));

    return NextResponse.json({ window, series });
  } catch (err) {
    logger.error({ err }, 'Failed to fetch self-audit history');
    return NextResponse.json({ error: 'Failed to fetch history data' }, { status: 500 });
  }
}
