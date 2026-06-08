export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';

interface Params { params: Promise<{ memberId: string }> }

export async function DELETE(req: NextRequest, { params }: Params): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { memberId } = await params;

  if (!isFullyConfigured()) return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });

  try {
    const { removeTeamMember } = await import('@sitenexis/db');
    await removeTeamMember(user.id, memberId);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
