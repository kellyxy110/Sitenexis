export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { logger } from '@/lib/logger';

interface Params { params: Promise<{ id: string }> }

function demoData(auditId: string) {
  return {
    auditId,
    url: 'https://example.com',
    sii_score: 67,
    confidence: 0.92,
    breakdown: {
      seo_readability: 74,
      ai_visibility: 58,
      semantic_structure: 61,
      entity_clarity: 52,
      retrieval_friendliness: 71,
      citation_potential: 63,
    },
    weighted_contributions: {
      seo_readability: 14.8,
      ai_visibility: 14.5,
      semantic_structure: 12.2,
      entity_clarity: 7.8,
      retrieval_friendliness: 7.1,
      citation_potential: 6.3,
    },
    insights: [
      'ai_visibility:58 — extraction pipeline failures reduce chunk quality',
      'entity_clarity:52 — primary entity ambiguity causes retrieval suppression',
      'semantic_structure:61 — extend schema coverage to product, FAQ, and author entities',
    ],
    critical_gaps: [
      'entity_clarity:52 — below critical threshold (50); direct score suppression',
    ],
    recommendation_priority: [
      {
        area: 'AI Visibility',
        action: 'Strengthen authorship trust signals and reduce semantic trust deficits on high-traffic pages',
        expected_gain: '+5pts to SII',
      },
      {
        area: 'Entity Clarity',
        action: 'Resolve entity attribute inconsistencies between schema and body text on top pages by PageRank',
        expected_gain: '+4pts to SII',
      },
      {
        area: 'Semantic Structure',
        action: 'Extend schema to author entities, breadcrumbs, and FAQ across informational content',
        expected_gain: '+4pts to SII',
      },
    ],
  };
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  if (!isFullyConfigured()) return NextResponse.json(demoData(id));

  try {
    const { getAuditWithResults, getSIIScore } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string; domain: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const sii = await getSIIScore(id);
    if (!sii) {
      return NextResponse.json(
        { error: 'SII score not yet available — run a new audit to generate it' },
        { status: 404 },
      );
    }

    return NextResponse.json({ auditId: id, ...sii, url: `https://${audit.domain}` });
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/sii failed');
    return NextResponse.json({ error: 'Failed to load SII score' }, { status: 500 });
  }
}
