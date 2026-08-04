export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';
import { rateLimit } from '@/lib/rate-limit';

interface Params { params: Promise<{ id: string }> }

/**
 * The one deliberate, explicitly-authorized way to force a fresh Intelligence
 * Report generation outside the automatic post-audit-completion hook.
 * Ordinary GETs on executive-summary/narrative-report never do this — this
 * is the only other call site of `generateAndPersistIntelligenceReport`.
 * Rate-limited since each call is a real LLM cost.
 */
export async function POST(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id } = await params;

  const rl = await rateLimit('report-regenerate', user.id, { limit: 5, windowSec: 3_600 });
  if (!rl.ok) {
    return NextResponse.json({ error: 'Too many regeneration requests. Please wait before trying again.' }, { status: 429, headers: rl.headers });
  }

  try {
    const { getAuditById, resetReportForRegeneration } = await import('@sitenexis/db');
    const audit = await getAuditById(id);
    if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    if (audit.status !== 'complete' && audit.status !== 'partial') {
      return NextResponse.json({ error: 'The Intelligence Report can only be generated for a complete or partial audit.' }, { status: 409 });
    }

    await resetReportForRegeneration(id);
    const { generateAndPersistIntelligenceReport } = await import('@/lib/audit-intelligence/report-generation-service');
    const result = await generateAndPersistIntelligenceReport(id);

    return NextResponse.json({ status: result.status });
  } catch (err) {
    logger.error({ err }, 'POST /api/audit/[id]/report/regenerate failed');
    return NextResponse.json({ error: 'Failed to regenerate the Intelligence Report' }, { status: 500 });
  }
}
