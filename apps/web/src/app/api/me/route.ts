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

  const isDemo = !isFullyConfigured();

  if (isDemo) {
    return NextResponse.json({ id: user.id, email: user.email, plan: 'free', isDemo: true });
  }

  try {
    const { getUserById } = await import('@sitenexis/db');
    const dbUser = await getUserById(user.id);
    return NextResponse.json({
      id: user.id,
      email: user.email,
      plan: dbUser?.plan ?? 'free',
      isDemo: false,
    });
  } catch {
    return NextResponse.json({ id: user.id, email: user.email, plan: 'free', isDemo: false });
  }
}
