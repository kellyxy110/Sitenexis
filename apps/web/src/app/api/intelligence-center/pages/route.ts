export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { comparePeriodMetric } from '@/lib/google/period-comparison';

const DEFAULT_PERIOD_DAYS = 7;
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
 * Search Console page-level intelligence: current-vs-previous-period clicks/
 * impressions comparison per page, using the canonical `comparePeriodMetric`
 * utility — the single source of truth for delta math across this Intelligence
 * Center (queries, pages, landing pages, acquisition all share it).
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const periodDays = clampPeriodDays(req.nextUrl.searchParams.get('days'));

  const { getGoogleConnection, getAggregatedSearchPageStats } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') return NextResponse.json({ connector: { status: connection.status } });
  if (!connection.gscSiteUrl) {
    return NextResponse.json({ connector: { status: connection.status }, periodDays, pages: [] });
  }

  const now = new Date();
  const currentStart = daysAgo(periodDays);
  const previousStart = daysAgo(periodDays * 2);
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    getAggregatedSearchPageStats(user.id, currentStart, now),
    getAggregatedSearchPageStats(user.id, previousStart, previousEnd),
  ]);

  const previousByPage = new Map(previous.map((p) => [p.page, p]));

  const pages = current
    .map((p) => {
      const prev = previousByPage.get(p.page) ?? null;
      return {
        page: p.page,
        clicks: p.clicks,
        impressions: p.impressions,
        ctr: p.ctr,
        avgPosition: p.avgPosition,
        clicksComparison: comparePeriodMetric(p.clicks, prev?.clicks ?? 0),
        impressionsComparison: comparePeriodMetric(p.impressions, prev?.impressions ?? 0),
        positionDelta: prev && prev.avgPosition > 0 ? prev.avgPosition - p.avgPosition : null,
      };
    })
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, RESULT_CAP);

  return NextResponse.json({
    connector: { status: connection.status },
    periodDays,
    pages,
  });
}
