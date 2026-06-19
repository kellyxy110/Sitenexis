export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { isFullyConfigured } from '@/lib/mode';
import { PLAN_LIMITS } from '@sitenexis/shared';
import { type Plan } from '@sitenexis/shared';

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try {
    user = await requireAuth(req);
  } catch {
    return unauthorizedResponse();
  }

  if (!isFullyConfigured()) {
    return NextResponse.json({
      plan: 'free',
      auditsUsed: 0,
      auditsLimit: PLAN_LIMITS.free.auditsPerMonth,
      layer4Access: false,
      competitiveAccess: false,
      creditBalance: 0,
      isUnlimited: false,
      isDemo: true,
    });
  }

  try {
    const { getUserById, countAuditsThisMonth, getUserCredits } = await import('@sitenexis/db');
    const [dbUser, credits, auditsUsed] = await Promise.all([
      getUserById(user.id),
      getUserCredits(user.id),
      countAuditsThisMonth(user.id),
    ]);

    const plan = (dbUser?.plan ?? 'free') as Plan;
    const limits = PLAN_LIMITS[plan];

    return NextResponse.json({
      plan,
      auditsUsed,
      auditsLimit: limits.auditsPerMonth,
      layer4Access: limits.layer4Analysis,
      competitiveAccess: limits.competitiveAnalysis,
      apiAccess: limits.apiAccess,
      bulkDomains: limits.bulkDomains,
      creditBalance: credits.balance,
      isUnlimited: credits.isUnlimited,
      isDemo: false,
    });
  } catch {
    return NextResponse.json({ error: 'Service unavailable' }, { status: 503 });
  }
}
