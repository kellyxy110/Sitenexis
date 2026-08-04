export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse } from '@/lib/gtl';
import { getNarrativeReport } from '@/lib/audit-intelligence/narrative-report-service';

interface Params { params: Promise<{ id: string }> }

/**
 * Read-only — see executive-summary/route.ts for the full rationale. This
 * route no longer generates the narrative report on a cache miss; it only
 * reads the canonical `AuditIntelligenceReport` row (with a legacy Redis
 * fallback). Same read function Telegram's /report command calls.
 */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  try {
    const { getAuditById } = await import('@sitenexis/db');
    const audit = await getAuditById(id);
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const result = await getNarrativeReport(id);
    if (!result) return gtlEmpty();

    if (!result.data) {
      return gtlResponse(result.state, {
        reportStatus: 'processing' as const,
        message: 'The narrative report has not been generated yet for this audit.',
      });
    }

    return gtlResponse(result.state, result.data);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/narrative-report failed');
    return NextResponse.json({ error: 'Failed to load narrative report' }, { status: 500 });
  }
}
