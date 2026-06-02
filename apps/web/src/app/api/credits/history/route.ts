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

  if (!isFullyConfigured()) {
    return NextResponse.json([]);
  }

  try {
    const { getCreditHistory } = await import('@sitenexis/db');
    const history = await getCreditHistory(user.id, 20);
    return NextResponse.json(history);
  } catch {
    return NextResponse.json([]);
  }
}
