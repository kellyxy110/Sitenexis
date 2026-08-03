export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { comparePeriodMetric } from '@/lib/google/period-comparison';

const DEFAULT_PERIOD_DAYS = 30;
const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 90;
const RESULT_CAP = 30;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

function clampPeriodDays(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_PERIOD_DAYS;
  if (!Number.isFinite(n)) return DEFAULT_PERIOD_DAYS;
  return Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, n));
}

/**
 * GA4 Landing Pages intelligence — the `landing_page_metrics` table has been
 * synced since the original Intelligence Center build but was previously
 * only consumed internally by the insight detectors, never surfaced to the
 * user directly. This route exposes it with the same period-comparison
 * treatment as Search Console pages/queries.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const periodDays = clampPeriodDays(req.nextUrl.searchParams.get('days'));

  const { getGoogleConnection, getAggregatedLandingPageMetrics } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') return NextResponse.json({ connector: { status: connection.status } });
  if (!connection.ga4PropertyId) {
    return NextResponse.json({ connector: { status: connection.status }, periodDays, landingPages: [] });
  }

  const now = new Date();
  const currentStart = daysAgo(periodDays);
  const previousStart = daysAgo(periodDays * 2);
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    getAggregatedLandingPageMetrics(user.id, currentStart, now),
    getAggregatedLandingPageMetrics(user.id, previousStart, previousEnd),
  ]);

  const previousByPath = new Map(previous.map((p) => [p.pagePath, p]));

  const landingPages = current
    .map((p) => {
      const prev = previousByPath.get(p.pagePath) ?? null;
      const engagementRate = p.sessions > 0 ? p.activeUsers / p.sessions : 0;
      return {
        pagePath: p.pagePath,
        sessions: p.sessions,
        activeUsers: p.activeUsers,
        keyEvents: p.keyEvents,
        avgEngagementTimeSec: p.avgEngagementTimeSec,
        engagementRate,
        sessionsComparison: comparePeriodMetric(p.sessions, prev?.sessions ?? 0),
        keyEventsComparison: comparePeriodMetric(p.keyEvents, prev?.keyEvents ?? 0),
      };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, RESULT_CAP);

  return NextResponse.json({
    connector: { status: connection.status },
    periodDays,
    landingPages,
  });
}
