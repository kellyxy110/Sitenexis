export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { z } from 'zod';

const InviteSchema = z.object({
  email: z.string().email(),
  role:  z.enum(['editor', 'viewer']).default('viewer'),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const body = await req.json().catch(() => ({})) as unknown;
  const parsed = InviteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  // Only agency/enterprise can invite
  if (!isFullyConfigured()) {
    return NextResponse.json({ error: 'Team features require a database connection.' }, { status: 503 });
  }

  try {
    const { getUserByEmail, createTeamInvite, isTeamMemberOf } = await import('@sitenexis/db');

    const targetUser = await getUserByEmail(parsed.data.email);

    // If user exists in system, add directly as member
    if (targetUser) {
      if (targetUser.id === user.id) {
        return NextResponse.json({ error: 'Cannot invite yourself.' }, { status: 400 });
      }
      const alreadyMember = await isTeamMemberOf(user.id, targetUser.id);
      if (alreadyMember) {
        return NextResponse.json({ error: 'User is already a team member.' }, { status: 409 });
      }
      const { addTeamMember } = await import('@sitenexis/db');
      const member = await addTeamMember(user.id, targetUser.id, parsed.data.role);
      return NextResponse.json({ type: 'added', member }, { status: 201 });
    }

    // User not in system — create invite link
    const invite = await createTeamInvite(user.id, parsed.data.email, parsed.data.role);
    return NextResponse.json({ type: 'invited', token: invite.token }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
