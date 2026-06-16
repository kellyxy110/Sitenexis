export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse, resolveGTLState } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params { params: Promise<{ id: string }> }

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return gtlEmpty();

  try {
    const { getAuditWithResults, getAIVisibilityScore, getEntitiesByAudit } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; status: AuditStatus } | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [visScore, entities] = await Promise.all([
      getAIVisibilityScore(id),
      getEntitiesByAudit(id),
    ]);

    const state = resolveGTLState(audit.status, !!visScore || entities.length > 0);

    const breakdown = (visScore?.breakdown as Record<string, unknown> | null) ?? {};
    const entityBreakdown = (breakdown['entityIntelligence'] as Record<string, unknown> | undefined) ?? {};

    return gtlResponse(state, {
      auditId: id,
      entityConfidenceScore: visScore?.entityConfidenceScore ?? null,
      entityConsistencyScore: (entityBreakdown['consistencyScore'] as number | undefined) ?? null,
      entityCoverageScore: (entityBreakdown['coverageScore'] as number | undefined) ?? null,
      disambiguationScore: (entityBreakdown['disambiguationScore'] as number | undefined) ?? null,
      entities: entities.map((e) => ({
        id: e.id,
        name: e.name,
        type: e.type,
        description: e.description,
        sameAsUrls: e.sameAsUrls,
        mentionCount: e.mentionCount,
        consistencyScore: e.consistencyScore,
        disambiguationScore: e.disambiguationScore,
      })),
      primaryEntity: entities[0] ? { id: entities[0].id, name: entities[0].name, type: entities[0].type } : null,
      inconsistencies: (entityBreakdown['inconsistencies'] as string[] | undefined) ?? [],
      missingAttributes: (entityBreakdown['missingAttributes'] as string[] | undefined) ?? [],
      recommendations: (entityBreakdown['recommendations'] as string[] | undefined) ?? [],
    });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/entities failed');
    return NextResponse.json({ error: 'Failed to load entity data' }, { status: 500 });
  }
}
