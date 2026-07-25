import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(request); } catch { return unauthorizedResponse(); }
  try {
    const domain = request.nextUrl.searchParams.get('domain') ?? undefined;
    const { getCitationIntelligenceHistory } = await import('@sitenexis/db');
    const history = await getCitationIntelligenceHistory(user.id, domain);
    return NextResponse.json({ history });
  } catch (error) {
    logger.error({ error, userId: user.id }, 'Citation Intelligence history failed');
    return NextResponse.json({ error: 'Unable to load citation history' }, { status: 500 });
  }
}
