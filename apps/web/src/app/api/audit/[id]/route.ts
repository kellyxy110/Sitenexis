export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { getDemoAudit } from '@/lib/demo-store';
import { isFullyConfigured } from '@/lib/mode';

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

  // Always try demo store first — covers both demo mode and fallback from failed real mode
  const demoAudit = getDemoAudit(id);
  if (demoAudit) {
    if (demoAudit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(demoAudit);
  }

  // ── Real mode ──────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const { getAuditWithResults } = await import('@sitenexis/db');
    const audit = await getAuditWithResults(id) as { userId: string } | null;
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json(audit);
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
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

  // ── Demo mode ──────────────────────────────────────────────────────────────
  if (!isFullyConfigured()) {
    const audit = getDemoAudit(id);
    if (!audit) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    if (audit.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    return NextResponse.json({ success: true });
  }

  // ── Real mode ──────────────────────────────────────────────────────────────
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
