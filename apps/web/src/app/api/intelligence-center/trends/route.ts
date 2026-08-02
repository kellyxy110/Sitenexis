export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

const WINDOW_DAYS: Record<string, number> = {
  daily: 30,
  weekly: 90,
  monthly: 365,
  quarterly: 730,
};

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

/**
 * Trend series for the intelligence-center report page's 4-granularity
 * switcher. Buckets real synced daily rows via the pure trend-bucketing
 * functions — never interpolates or fabricates points.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const granularity = req.nextUrl.searchParams.get('granularity') ?? 'daily';
  if (!(granularity in WINDOW_DAYS)) {
    return NextResponse.json({ error: 'Invalid granularity — expected daily, weekly, monthly, or quarterly' }, { status: 400 });
  }

  const { getGoogleConnection, getDailyTrafficMetrics, getSearchVisibilityMetrics } = await import('@sitenexis/db');
  const { bucketTrafficSeries, bucketSearchSeries } = await import('@sitenexis/analyzers');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') {
    return NextResponse.json({ connector: { status: connection.status } });
  }

  const from = daysAgo(WINDOW_DAYS[granularity]!);
  const to = new Date();

  const [trafficRows, searchRows] = await Promise.all([
    connection.ga4PropertyId ? getDailyTrafficMetrics(user.id, from, to) : Promise.resolve([]),
    connection.gscSiteUrl ? getSearchVisibilityMetrics(user.id, from, to) : Promise.resolve([]),
  ]);

  const traffic = bucketTrafficSeries(
    trafficRows.map((r) => ({ date: r.date, sessions: r.sessions, activeUsers: r.activeUsers })),
    granularity as 'daily' | 'weekly' | 'monthly' | 'quarterly',
  );
  const search = bucketSearchSeries(
    searchRows.map((r) => ({ date: r.date, clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, avgPosition: r.avgPosition })),
    granularity as 'daily' | 'weekly' | 'monthly' | 'quarterly',
  );

  return NextResponse.json({
    connector: { status: connection.status },
    granularity,
    traffic,
    search,
  });
}
