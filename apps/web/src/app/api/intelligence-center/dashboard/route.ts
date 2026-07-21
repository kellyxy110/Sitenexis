export const dynamic = 'force-dynamic';
import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth, unauthorizedResponse } from '@/lib/auth';

const RANGE_DAYS = 30;
const GAINS_LOSSES_PERIOD_DAYS = 7;
const TOP_N = 10;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3_600_000);
}

/**
 * One-call aggregation for the AI Visibility Intelligence Center dashboard.
 * connector.status mirrors GoogleConnectionStatus directly (connected/pending/
 * expired/error) plus a synthetic 'not_connected' when no connection row exists
 * at all — the client renders one of five explicit states from this alone.
 */
export async function GET(req: NextRequest): Promise<NextResponse> {
  let user: Awaited<ReturnType<typeof requireAuth>>;
  try { user = await requireAuth(req); } catch { return unauthorizedResponse(); }

  const {
    getGoogleConnection, getDailyTrafficMetrics, getAcquisitionChannelMetrics, getAiReferralMetrics,
    getSearchVisibilityMetrics, getTopSearchQueries, getTopSearchPages, getAggregatedSearchPageMetrics,
    getAiVisibilityInsights,
  } = await import('@sitenexis/db');

  const connection = await getGoogleConnection(user.id);
  if (!connection) {
    return NextResponse.json({ connector: { status: 'not_connected' } });
  }

  // Non-'connected' states map straight through — no data was ever going to be there.
  if (connection.status === 'pending') {
    return NextResponse.json({ connector: { status: 'pending', googleAccountEmail: connection.googleAccountEmail } });
  }
  if (connection.status === 'expired') {
    return NextResponse.json({ connector: { status: 'permission_expired', googleAccountEmail: connection.googleAccountEmail } });
  }
  if (connection.status === 'error') {
    return NextResponse.json({ connector: { status: 'sync_failed', googleAccountEmail: connection.googleAccountEmail, lastError: connection.lastError } });
  }

  const from = daysAgo(RANGE_DAYS);
  const to = new Date();

  const [daily, channels, aiReferrals, search, topQueries, topPages, insights] = await Promise.all([
    connection.ga4PropertyId ? getDailyTrafficMetrics(user.id, from, to) : Promise.resolve([]),
    connection.ga4PropertyId ? getAcquisitionChannelMetrics(user.id, from, to) : Promise.resolve([]),
    connection.ga4PropertyId ? getAiReferralMetrics(user.id, from, to) : Promise.resolve([]),
    connection.gscSiteUrl ? getSearchVisibilityMetrics(user.id, from, to) : Promise.resolve([]),
    connection.gscSiteUrl ? getTopSearchQueries(user.id, from, to, TOP_N) : Promise.resolve([]),
    connection.gscSiteUrl ? getTopSearchPages(user.id, from, to, TOP_N) : Promise.resolve([]),
    getAiVisibilityInsights(user.id, TOP_N * 2),
  ]);

  // ── No data yet — connected, but the daily cron hasn't produced rows (or has
  // run but genuinely found nothing, e.g. a brand-new GA4 property) ────────────
  const hasAnyData = daily.length > 0 || search.length > 0;
  if (!hasAnyData) {
    return NextResponse.json({
      connector: {
        status: connection.lastSyncedAt ? 'no_data' : 'sync_pending',
        googleAccountEmail: connection.googleAccountEmail,
        ga4PropertyName: connection.ga4PropertyName,
        gscSiteName: connection.gscSiteName,
        lastSyncedAt: connection.lastSyncedAt,
      },
    });
  }

  // ── Traffic + channels + AI referrals ────────────────────────────────────────
  const totalVisitors = daily.reduce((s, d) => s + d.activeUsers, 0);
  const totalSessions = daily.reduce((s, d) => s + d.sessions, 0);
  const channelTotals = new Map<string, number>();
  for (const c of channels) channelTotals.set(c.channelGroup, (channelTotals.get(c.channelGroup) ?? 0) + c.sessions);
  const totalAiReferralSessions = aiReferrals.reduce((s, r) => s + r.sessions, 0);

  // ── Search visibility ─────────────────────────────────────────────────────────
  const totalClicks = search.reduce((s, d) => s + d.clicks, 0);
  const totalImpressions = search.reduce((s, d) => s + d.impressions, 0);
  const avgCtr = search.length > 0 ? search.reduce((s, d) => s + d.ctr, 0) / search.length : 0;
  const avgPosition = search.length > 0 ? search.reduce((s, d) => s + d.avgPosition, 0) / search.length : 0;

  // ── Visibility gains/losses — compare this week vs the prior week, per page ──
  let visibilityGains: Array<{ page: string; deltaImpressions: number; current: number; previous: number }> = [];
  let visibilityLosses: Array<{ page: string; deltaImpressions: number; current: number; previous: number }> = [];
  if (connection.gscSiteUrl) {
    const currentStart = daysAgo(GAINS_LOSSES_PERIOD_DAYS);
    const previousStart = daysAgo(GAINS_LOSSES_PERIOD_DAYS * 2);
    const previousEnd = daysAgo(GAINS_LOSSES_PERIOD_DAYS);
    const [current, previous] = await Promise.all([
      getAggregatedSearchPageMetrics(user.id, currentStart, to),
      getAggregatedSearchPageMetrics(user.id, previousStart, previousEnd),
    ]);
    const previousByPage = new Map(previous.map((p) => [p.page, p.impressions]));
    const deltas = current.map((p) => {
      const prev = previousByPage.get(p.page) ?? 0;
      return { page: p.page, deltaImpressions: p.impressions - prev, current: p.impressions, previous: prev };
    }).filter((d) => d.deltaImpressions !== 0);
    visibilityGains = deltas.filter((d) => d.deltaImpressions > 0).sort((a, b) => b.deltaImpressions - a.deltaImpressions).slice(0, TOP_N);
    visibilityLosses = deltas.filter((d) => d.deltaImpressions < 0).sort((a, b) => a.deltaImpressions - b.deltaImpressions).slice(0, TOP_N);
  }

  return NextResponse.json({
    connector: {
      status: connection.status,
      googleAccountEmail: connection.googleAccountEmail,
      ga4PropertyName: connection.ga4PropertyName,
      gscSiteName: connection.gscSiteName,
      lastSyncedAt: connection.lastSyncedAt,
    },
    traffic: { totalVisitors, totalSessions, dailySeries: daily.map((d) => ({ date: d.date, sessions: d.sessions, activeUsers: d.activeUsers })) },
    channels: [...channelTotals.entries()].map(([channelGroup, sessions]) => ({ channelGroup, sessions })).sort((a, b) => b.sessions - a.sessions),
    aiReferrals: { totalSessions: totalAiReferralSessions, bySource: aiReferrals.map((r) => ({ source: r.source, sessions: r.sessions, date: r.date })) },
    search: { totalClicks, totalImpressions, avgCtr, avgPosition, dailySeries: search.map((d) => ({ date: d.date, clicks: d.clicks, impressions: d.impressions, ctr: d.ctr, avgPosition: d.avgPosition })) },
    topQueries: topQueries.map((q) => ({ query: q.query, clicks: q.clicks, impressions: q.impressions, ctr: q.ctr, avgPosition: q.avgPosition })),
    topPages: topPages.map((p) => ({ page: p.page, clicks: p.clicks, impressions: p.impressions, ctr: p.ctr, avgPosition: p.avgPosition })),
    visibilityGains,
    visibilityLosses,
    insights: insights.map((i) => ({
      id: i.id,
      type: i.type,
      affectedPage: i.affectedPage,
      evidence: i.evidence,
      confidence: i.confidence,
      recommendedAction: i.recommendedAction,
      verificationMethod: i.verificationMethod,
      severity: i.severity,
      createdAt: i.createdAt,
    })),
  });
}
