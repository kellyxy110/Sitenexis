export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    entityConfidenceScore: 78,
    entityConsistencyScore: 82,
    entityCoverageScore: 74,
    disambiguationScore: 79,
    entities: [
      { id: 'e1', name: 'Example Corp', type: 'Organization', description: 'A technology company', sameAsUrls: ['https://wikidata.org/wiki/Q000'], mentionCount: 47, consistencyScore: 0.87, disambiguationScore: 0.84 },
      { id: 'e2', name: 'Core Product', type: 'SoftwareApplication', description: 'Primary software offering', sameAsUrls: [], mentionCount: 31, consistencyScore: 0.76, disambiguationScore: 0.71 },
      { id: 'e3', name: 'Founder Name', type: 'Person', description: null, sameAsUrls: [], mentionCount: 12, consistencyScore: 0.62, disambiguationScore: 0.55 },
    ],
    primaryEntity: { id: 'e1', name: 'Example Corp', type: 'Organization' },
    inconsistencies: [],
    missingAttributes: ['foundingDate', 'numberOfEmployees', 'areaServed'],
    recommendations: [
      'Add foundingDate to Organization schema.',
      'Increase sameAs coverage for the primary entity to at least 5 external sources.',
      'Clarify author entity with external attribution links.',
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getAIVisibilityScore, getEntitiesByAudit } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const [visScore, entities] = await Promise.all([
      getAIVisibilityScore(id),
      getEntitiesByAudit(id),
    ]);

    const breakdown = (visScore?.breakdown as Record<string, unknown> | null) ?? {};
    const entityBreakdown = (breakdown['entityIntelligence'] as Record<string, unknown> | undefined) ?? {};

    return NextResponse.json({
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
