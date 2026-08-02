export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

/**
 * Lightweight, ownership-scoped lookup for `/audit/[domain]` navigation with
 * no `auditId` in the URL. Replaces fetching up to 50 full audit records
 * (with score breakdown JSON) and filtering client-side — this returns only
 * the id/status/errorMessage needed to resolve which audit to load, or which
 * status message to show.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get('domain');
  if (!domain) return NextResponse.json({ error: 'domain is required' }, { status: 400 });

  try {
    const { getLatestAuditByDomain } = await import('@sitenexis/db');
    const [match, latest] = await Promise.all([
      getLatestAuditByDomain(domain, user.id, 'complete'),
      getLatestAuditByDomain(domain, user.id),
    ]);

    return NextResponse.json({
      match: match ? { id: match.id, status: match.status } : null,
      latest: latest ? { id: latest.id, status: latest.status, errorMessage: latest.errorMessage } : null,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
