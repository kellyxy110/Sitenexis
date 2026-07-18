export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

interface Params { params: Promise<{ id: string; pageId: string }> }

/** GET — list past optimization sessions for this page, newest first (for the diff/history view). */
export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }
  const { id: auditId, pageId } = await params;

  const { getAuditWithResults, getOptimizationSessionsForPage } = await import('@sitenexis/db');
  const audit = await getAuditWithResults(auditId) as { userId: string } | null;
  if (!audit) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sessions = await getOptimizationSessionsForPage(pageId, user.id);
  return NextResponse.json({ sessions });
}
