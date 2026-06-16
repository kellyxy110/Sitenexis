export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { gtlEmpty, gtlResponse } from '@/lib/gtl';
import type { AuditStatus } from '@sitenexis/shared';

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isFullyConfigured()) return gtlEmpty();

  try {
    const { getAuditWithResults } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as ({ userId: string; status: AuditStatus } & Record<string, unknown>) | null;
    if (!audit) return gtlEmpty();
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const state = audit.status === 'complete' ? 'complete'
      : audit.status === 'running' || audit.status === 'queued' ? 'partial'
      : 'empty';

    return gtlResponse(state, audit);
  } catch {
    return gtlEmpty();
  }
}

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { getAuditWithResults, softDeleteAudit } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    await softDeleteAudit(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
