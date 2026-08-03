export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';
import { classifyQueries, groupQueriesByClassification, type ClassifiedQuery, type QueryClassification } from '@/lib/google/query-classification';

const DEFAULT_PERIOD_DAYS = 7;
const MIN_PERIOD_DAYS = 1;
const MAX_PERIOD_DAYS = 90;
const GROUP_CAP = 20;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

function clampPeriodDays(raw: string | null): number {
  const n = raw ? Number.parseInt(raw, 10) : DEFAULT_PERIOD_DAYS;
  if (!Number.isFinite(n)) return DEFAULT_PERIOD_DAYS;
  return Math.min(MAX_PERIOD_DAYS, Math.max(MIN_PERIOD_DAYS, n));
}

function serializeQuery(q: ClassifiedQuery) {
  return {
    query: q.query,
    clicks: q.current.clicks,
    impressions: q.current.impressions,
    ctr: q.current.ctr,
    avgPosition: q.current.avgPosition,
    previousClicks: q.previous?.clicks ?? null,
    previousImpressions: q.previous?.impressions ?? null,
    clicksPercentageDelta: q.clicksComparison.percentageDelta,
    impressionsPercentageDelta: q.impressionsComparison.percentageDelta,
    positionDelta: q.positionDelta,
    classifications: q.classifications,
  };
}

const GROUP_SORTERS: Record<QueryClassification, (a: ClassifiedQuery, b: ClassifiedQuery) => number> = {
  rising: (a, b) => (b.impressionsComparison.percentageDelta ?? 0) - (a.impressionsComparison.percentageDelta ?? 0),
  declining: (a, b) => (a.impressionsComparison.percentageDelta ?? 0) - (b.impressionsComparison.percentageDelta ?? 0),
  high_impression_low_ctr: (a, b) => b.current.impressions - a.current.impressions,
  near_page_one: (a, b) => b.current.impressions - a.current.impressions,
  losing_position: (a, b) => (a.positionDelta ?? 0) - (b.positionDelta ?? 0),
  gaining_position: (a, b) => (b.positionDelta ?? 0) - (a.positionDelta ?? 0),
};

/**
 * Deterministic Search Console query intelligence: six classification
 * groups (rising/declining/high-impression-low-ctr/near-page-one/losing-
 * position/gaining-position), each derived from real synced
 * `SearchQueryMetric` rows compared current-period vs previous-period via
 * the canonical `comparePeriodMetric`/`classifyQueries` utilities. No LLM,
 * no fabricated trend — see query-classification.ts for the exact rules.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const periodDays = clampPeriodDays(req.nextUrl.searchParams.get('days'));

  const { getGoogleConnection, getAggregatedSearchQueryMetrics } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) return NextResponse.json({ connector: { status: 'not_connected' } });
  if (connection.status !== 'connected') return NextResponse.json({ connector: { status: connection.status } });
  if (!connection.gscSiteUrl) {
    return NextResponse.json({ connector: { status: connection.status }, periodDays, totalQueries: 0, groups: null });
  }

  const now = new Date();
  const currentStart = daysAgo(periodDays);
  const previousStart = daysAgo(periodDays * 2);
  const previousEnd = currentStart;

  const [current, previous] = await Promise.all([
    getAggregatedSearchQueryMetrics(user.id, currentStart, now),
    getAggregatedSearchQueryMetrics(user.id, previousStart, previousEnd),
  ]);

  if (current.length === 0) {
    return NextResponse.json({ connector: { status: connection.status }, periodDays, totalQueries: 0, groups: null });
  }

  const classified = classifyQueries(current, previous);
  const grouped = groupQueriesByClassification(classified);

  const groups: Record<QueryClassification, ReturnType<typeof serializeQuery>[]> = {
    rising: [], declining: [], high_impression_low_ctr: [], near_page_one: [], losing_position: [], gaining_position: [],
  };
  (Object.keys(grouped) as QueryClassification[]).forEach((key) => {
    groups[key] = [...grouped[key]].sort(GROUP_SORTERS[key]).slice(0, GROUP_CAP).map(serializeQuery);
  });

  return NextResponse.json({
    connector: { status: connection.status },
    periodDays,
    totalQueries: classified.length,
    groups,
  });
}
