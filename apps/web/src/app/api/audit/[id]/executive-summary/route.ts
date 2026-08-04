export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { gtlEmpty, gtlResponse } from '@/lib/gtl';
import { getExecutiveSummary } from '@/lib/audit-intelligence/executive-summary-service';

interface Params { params: Promise<{ id: string }> }

/**
 * Read-only. This route used to generate the executive summary on a Redis
 * cache miss — it no longer does. Generation now happens exactly once, via
 * `generateAndPersistIntelligenceReport`, triggered by the post-audit
 * completion hook (or the explicit regeneration route). An ordinary GET here
 * only ever reads the canonical `AuditIntelligenceReport` row (falling back
 * to a legacy Redis cache) — see `getExecutiveSummary` for the exact lookup
 * order. This is the same function Telegram's /audit command calls, so both
 * surfaces are guaranteed to show the same content for the same audit.
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

    const result = await getExecutiveSummary(id);
    if (!result) return gtlEmpty();

    if (!result.data) {
      return gtlResponse(result.state, {
        reportStatus: 'processing' as const,
        message: 'The executive summary has not been generated yet for this audit.',
      });
    }

    return gtlResponse(result.state, result.data);
  } catch (err) {
    logger.error({ err }, 'GET /api/audit/[id]/executive-summary failed');
    return NextResponse.json({ error: 'Failed to load executive summary' }, { status: 500 });
  }
}
