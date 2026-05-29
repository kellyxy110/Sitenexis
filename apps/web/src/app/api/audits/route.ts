import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { listDemoAudits } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { searchParams } = new URL(req.url);
  const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get('pageSize') ?? '20', 10)));

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    void user;
    const all   = listDemoAudits();
    const total = all.length;
    const start = (page - 1) * pageSize;
    const data  = all.slice(start, start + pageSize).map((a) => ({
      id:          a.id,
      domain:      a.domain,
      status:      a.status,
      createdAt:   a.createdAt,
      completedAt: a.completedAt,
      scores:      a.scores
        ? {
            overall:          a.scores.overall,
            seoScore:         a.scores.seoScore,
            aiScore:          a.scores.aiScore,
            schemaScore:      a.scores.schemaScore,
            linkGraphScore:   a.scores.linkGraphScore,
            performanceScore: a.scores.performanceScore,
          }
        : null,
      _count: { issues: a.issues.length },
    }));

    return NextResponse.json({ data, total, page, pageSize, hasMore: start + pageSize < total });
  }

  // ── Real mode ──────────────────────────────────────────────────────────────
  try {
    const { listAuditsByUser } = await import('@sitenexis/db');
    const { data, total } = await listAuditsByUser(user.id, page, pageSize);
    return NextResponse.json({ data, total, page, pageSize, hasMore: page * pageSize < total });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
