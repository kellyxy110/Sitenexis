export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  if (!isFullyConfigured()) return NextResponse.json([]);

  try {
    const { getTeamMembers } = await import('@sitenexis/db');
    const members = await getTeamMembers(user.id);
    return NextResponse.json(
      members.map((m) => ({
        id:       m.id,
        email:    m.member.email,
        name:     m.member.name,
        role:     m.role,
        joinedAt: m.joinedAt,
      })),
    );
  } catch {
    return NextResponse.json([]);
  }
}
