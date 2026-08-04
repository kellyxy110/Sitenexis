export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';

// Same owner allowlist already used to gate the other admin-only surfaces
// (intelligence-center admin view, observability overview).
const OWNER_EMAILS = new Set([
  'kellyxy110@gmail.com',
  'luchijudith@gmail.com',
  'judithluchi@gmail.com',
]);

interface BackfillBody {
  auditId?: unknown;
}

/**
 * Explicit, administrator-controlled backfill for a single historical audit
 * that has scores/evidence but no canonical Intelligence Report (i.e. it
 * completed before `generateAndPersistIntelligenceReport` existed, or its
 * generation failed and was never retried).
 *
 * Deliberately one audit per call — there is no "backfill everything"
 * endpoint. Regenerating prose for the entire historical audit corpus in one
 * shot is an uncontrolled LLM cost risk; an administrator must name each
 * audit explicitly. Idempotent via the same `claimReportGeneration` used by
 * the automatic post-audit path, so calling this twice for the same audit is
 * a safe no-op the second time (unless the report previously failed).
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!OWNER_EMAILS.has(user.email?.toLowerCase() ?? '')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: BackfillBody;
  try {
    body = await req.json() as BackfillBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const auditId = typeof body.auditId === 'string' ? body.auditId.trim() : '';
  if (!auditId) {
    return NextResponse.json({ error: 'auditId is required' }, { status: 400 });
  }

  const { getAuditById } = await import('@sitenexis/db');
  const audit = await getAuditById(auditId);
  if (!audit) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }
  if (audit.status !== 'complete' && audit.status !== 'partial') {
    return NextResponse.json({ error: `Audit status "${audit.status}" is not report-eligible — only complete or partial audits can be backfilled.` }, { status: 409 });
  }

  const { generateAndPersistIntelligenceReport } = await import('@/lib/audit-intelligence/report-generation-service');
  const result = await generateAndPersistIntelligenceReport(auditId);

  logger.info({ auditId, domain: audit.domain, adminEmail: user.email, result: result.status }, 'Admin-triggered Intelligence Report backfill');

  return NextResponse.json({ auditId, domain: audit.domain, status: result.status });
}
