export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
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

  if (!isFullyConfigured()) {
    return NextResponse.json({ data: [], total: 0, page, pageSize, hasMore: false });
  }

  try {
    const { listAuditsByUser } = await import('@sitenexis/db');
    const { data, total } = await listAuditsByUser(user.id, page, pageSize);
    return NextResponse.json({ data, total, page, pageSize, hasMore: page * pageSize < total });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
