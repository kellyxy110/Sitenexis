export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';

const OWNER_EMAILS = [
  'kellyxy110@gmail.com',
  'luchijudith@gmail.com',
];

function isOwner(email: string | undefined | null): boolean {
  if (!email) return false;
  return OWNER_EMAILS.includes(email.toLowerCase());
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  // Owner always gets full enterprise access
  if (isOwner(user.email)) {
    return NextResponse.json({
      id: user.id,
      email: user.email,
      plan: 'enterprise',
      isDemo: false,
      creditBalance: 999999,
      isUnlimited: true,
    });
  }

  const isDemo = !isFullyConfigured();

  if (isDemo) {
    return NextResponse.json({ id: user.id, email: user.email, plan: 'free', isDemo: true });
  }

  try {
    const { upsertUser, getUserById, getUserCredits } = await import('@sitenexis/db');
    await upsertUser(user.id, user.email);
    const [dbUser, credits] = await Promise.all([
      getUserById(user.id),
      getUserCredits(user.id),
    ]);
    return NextResponse.json({
      id: user.id,
      email: user.email,
      plan: dbUser?.plan ?? 'free',
      isDemo: false,
      creditBalance: credits.balance,
      isUnlimited: credits.isUnlimited,
    });
  } catch {
    return NextResponse.json({
      id: user.id,
      email: user.email,
      plan: 'free',
      isDemo: false,
      creditBalance: 0,
      isUnlimited: false,
    });
  }
}
