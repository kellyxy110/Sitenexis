export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

const RANGE_DAYS = 30;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const { getGoogleConnection, getAggregatedBreakdowns } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') {
    return NextResponse.json({ connector: { status: connection.status } });
  }

  const breakdowns = await getAggregatedBreakdowns(user.id, daysAgo(RANGE_DAYS), new Date());

  return NextResponse.json({
    connector: { status: connection.status },
    ...breakdowns,
  });
}
